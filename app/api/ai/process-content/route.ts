// app/api/ai/process-content/route.ts
// Pipeline: strip HTML → chunk → embed → Graph RAG → save
// + Vision Embedding: embed images directly for cross-modal retrieval
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logging/redact'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import { chunkDocument } from '@/lib/ai/chunker'
import { analyzeContentImages, embedContentImages } from '@/lib/ai/image-extractor'
import { env } from '@/lib/env'

export const maxDuration = 120 // Allow up to 2 minutes for large articles

function stripHtml(html: string) {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s\s+/g, ' ').trim()
}

// Helper to update processing log in DB
async function updateProcessingLog(
    contentId: string,
    status: string,
    message: string,
    progress: number
) {
    const newEntry = { time: new Date().toISOString(), message, progress }
    const entryJson = JSON.stringify([newEntry])
    // Use jsonb concatenation to prevent race conditions during concurrent updates
    await prisma.$executeRaw`
        UPDATE contents
        SET processing_status = ${status},
            processing_log = COALESCE(processing_log, '[]'::jsonb) || ${entryJson}::jsonb
        WHERE id = ${contentId}
    `
}

export async function POST(req: NextRequest) {
    // Security: accept calls from internal server actions only
    const secret = req.headers.get('x-internal-secret')
    if (secret !== env.CRON_SECRET) {
        return ApiResponse.forbidden('process-content endpoint')
    }

    let contentId: string
    try {
        const body = await req.json()
        contentId = body.contentId
    } catch {
        return ApiResponse.validationError({ body: 'Invalid JSON' })
    }
    if (!contentId) {
        return ApiResponse.validationError({ contentId: 'required' })
    }

    // Fetch content from DB
    const content = await prisma.content.findUnique({
        where: { id: contentId },
    })

    if (!content) {
        return ApiResponse.notFound('Content')
    }

    // Run background processing without awaiting
    processContentInBackground(contentId, content).catch(err => {
        logger.error(`Critical failure in background processing for ${contentId}:`, err)
    })

    return NextResponse.json({ success: true, message: 'Processing started in background' })
}

async function processContentInBackground(contentId: string, content: any) {
    console.log(`\n🔄 [PROCESS] Starting background processing for Article ${contentId} (${content.title})`)
    try {
        await updateProcessingLog(contentId, 'processing', 'Memulai pemrosesan artikel...', 5)
    } catch (logErr) {
        console.error(`❌ [PROCESS] updateProcessingLog FAILED for ${contentId}:`, logErr)
    }

    try {
        // STEP 1: Extract and clean text
        const msg1 = 'Membersihkan dan mengekstrak teks artikel...'
        await updateProcessingLog(contentId, 'processing', msg1, 15)

        const rawText = stripHtml(content.body) || 'Artikel kosong.'

        console.log(`✅ [PROCESS] Extracted article text, ${rawText.length} chars from ${content.title}`)

        // STEP 2: Get AI service for this organization (needed for image analysis & embedding)
        const ai = await getAIServiceForOrg(content.organization_id)
        console.log(`✅ [PROCESS] Got AI service: ${ai.providerName}, embedding: ${ai.embeddingModel}`)

        // STEP 1.5: Analyze images in article content using AI Vision (Qwen 3.5)
        const msgImg = 'Menganalisis gambar dalam artikel dengan AI Vision...'
        await updateProcessingLog(contentId, 'processing', msgImg, 25)

        let imageDescriptions = ''
        try {
            imageDescriptions = await analyzeContentImages(
                ai, content.image_url, content.body, content.title
            )
            if (imageDescriptions) {
                console.log(`✅ [PROCESS] Image analysis complete for "${content.title}", ${imageDescriptions.length} chars of descriptions`)
            } else {
                console.log(`ℹ️ [PROCESS] No images found or no descriptions generated for "${content.title}"`)
            }
        } catch (imgErr) {
            console.error(`⚠️ [PROCESS] Image analysis failed (non-fatal):`, imgErr)
            // Non-fatal: continue processing without image descriptions
        }

        // Combine article text with image descriptions
        let enrichedText = imageDescriptions
            ? `${rawText}\n\n--- Deskripsi Visual dari Gambar ---\n${imageDescriptions}`
            : rawText

        // STEP 1.7: Include text from linked source_documents (if any)
        const sourceDocIds = content.source_documents || []
        if (sourceDocIds.length > 0) {
            try {
                const msgLinked = 'Membaca dokumen sumber terlampir...'
                await updateProcessingLog(contentId, 'processing', msgLinked, 30)

                const linkedDocs = await prisma.document.findMany({
                    where: {
                        id: { in: sourceDocIds },
                        is_processed: true,
                    },
                    select: { id: true, file_name: true, ai_title: true, ai_summary: true },
                })

                if (linkedDocs.length > 0) {
                    // Fetch existing chunks from linked documents to get their text
                    const linkedChunks = await prisma.$queryRawUnsafe<
                        { document_id: string; doc_title: string; content: string }[]
                    >(
                        `SELECT
                            dc.document_id,
                            COALESCE(d.ai_title, d.file_name) AS doc_title,
                            dc.content
                        FROM document_chunks dc
                        JOIN documents d ON dc.document_id = d.id
                        WHERE dc.document_id IN (${linkedDocs.map(d => `'${d.id}'`).join(',')})
                          AND dc.chunk_type = 'text'
                        ORDER BY dc.document_id, dc.chunk_index
                        LIMIT 50`
                    )

                    if (linkedChunks.length > 0) {
                        // Group by document
                        const docTexts = new Map<string, { title: string; texts: string[] }>()
                        for (const chunk of linkedChunks) {
                            const entry = docTexts.get(chunk.document_id) || { title: chunk.doc_title, texts: [] }
                            entry.texts.push(chunk.content)
                            docTexts.set(chunk.document_id, entry)
                        }

                        let linkedText = '\n\n--- Konteks dari Dokumen Sumber Terlampir ---'
                        for (const [, docData] of docTexts) {
                            // Limit each document's text to prevent overly large chunks
                            const docContent = docData.texts.join('\n').slice(0, 8000)
                            linkedText += `\n\n[Dokumen: ${docData.title}]\n${docContent}`
                        }

                        enrichedText += linkedText
                        console.log(`✅ [PROCESS] Included text from ${docTexts.size} linked document(s) for "${content.title}"`)
                    }

                    // Also include summaries of linked documents
                    const summaries = linkedDocs
                        .filter(d => d.ai_summary)
                        .map(d => `- ${d.ai_title || d.file_name}: ${d.ai_summary}`)
                    if (summaries.length > 0) {
                        enrichedText += `\n\n--- Ringkasan Dokumen Sumber ---\n${summaries.join('\n')}`
                    }
                }
            } catch (linkedErr) {
                console.warn(`⚠️ [PROCESS] Failed to include linked documents (non-fatal):`, linkedErr)
                // Non-fatal: continue processing without linked document text
            }
        }

        // Treat the whole article as a single "page" for chunker
        const pages = [{ pageNum: 1, text: `${content.title}\n\n${enrichedText}` }]

        // STEP 3: Update Content with AI embedding model
        await prisma.content.update({
            where: { id: contentId },
            data: {
                embedding_model: ai.embeddingModel,
            },
        })

        // STEP 4: Chunk document semantically
        const msg4 = 'Memotong artikel menjadi beberapa bagian indeks...'
        await updateProcessingLog(contentId, 'processing', msg4, 40)

        const chunks = chunkDocument(pages)
        logger.info(`Created ${chunks.length} chunks for ${contentId}`)

        // STEP 5: Remove old chunks if re-processing
        await prisma.contentChunk.deleteMany({
            where: { content_id: contentId },
        })

        // STEP 6: Embed each chunk and save to DB
        const pLimit = (await import('p-limit')).default
        const limit = pLimit(4) // Max 4 concurrent concurrent embedding requests

        const totalChunks = chunks.length
        let processedChunks = 0

        await Promise.all(
            chunks.map((chunk, i) =>
                limit(async () => {
                    processedChunks++
                    const currentProgress = 40 + Math.floor((processedChunks / totalChunks) * 40)
                    const embMsg = `Membuat vektor embeddings (Bagian ${processedChunks}/${totalChunks})...`

                    // Check if cancelled
                    const currentContent = await prisma.content.findUnique({
                        where: { id: contentId },
                        select: { processing_status: true }
                    })
                    if (currentContent?.processing_status === 'failed') {
                        throw new Error('Proses dihentikan oleh pengguna.')
                    }

                    // Only send progress updates for every 3rd chunk to avoid overwhelming the client/DB
                    if (processedChunks === 0 || processedChunks === totalChunks - 1 || processedChunks % 3 === 0) {
                        await updateProcessingLog(contentId, 'processing', embMsg, currentProgress)
                    }

                    const embedding = await ai.generateEmbedding(chunk.content)
                    const embeddingString = `[${embedding.join(',')}]`
                    try {
                        await prisma.$executeRaw`
                            INSERT INTO content_chunks
                            (id, content_id, chunk_index, content, embedding, token_count, created_at)
                            VALUES
                            (gen_random_uuid()::text, ${contentId}, ${chunk.chunkIndex}, ${chunk.content}, CAST(${embeddingString} AS vector), ${chunk.tokenCount}, NOW())
                        `
                    } catch (dbErr: any) {
                        console.error(`❌ [PROCESS] DB Insert FAILED for Article chunk ${i}:`, dbErr.message)
                        throw new Error(`Database Error: ${dbErr.message}`)
                    }
                    processedChunks++
                })
            )
        )

        const msgFinal = 'Merapikan dan menyimpan hasil pemrosesan...'
        await updateProcessingLog(contentId, 'processing', msgFinal, 85)

        // STEP 6.5: Vision Embedding — embed images directly as vectors (experimental)
        if (ai.generateImageEmbedding && ai.visionEmbedModel) {
            const msgVision = 'Membuat vektor embedding gambar dengan Vision AI (eksperimental)...'
            await updateProcessingLog(contentId, 'processing', msgVision, 87)

            try {
                const imageEmbeddings = await embedContentImages(
                    ai, content.image_url, content.body, content.title
                )

                if (imageEmbeddings.length > 0) {
                    console.log(`🖼️ [PROCESS] Saving ${imageEmbeddings.length} image embedding chunks for "${content.title}"`)

                    for (const imgEmbed of imageEmbeddings) {
                        const embeddingString = `[${imgEmbed.embedding.join(',')}]`
                        const imgContent = `[${imgEmbed.label}] Gambar dalam artikel "${content.title}"`

                        await prisma.$executeRaw`
                            INSERT INTO content_chunks
                            (id, content_id, chunk_index, content, image_embedding, token_count, chunk_type, image_source, created_at)
                            VALUES
                            (gen_random_uuid()::text, ${contentId}, ${1000 + imgEmbed.index}, ${imgContent}, CAST(${embeddingString} AS vector), ${0}, 'image', ${imgEmbed.label}, NOW())
                        `
                    }
                    console.log(`✅ [PROCESS] ${imageEmbeddings.length} image chunks saved for "${content.title}"`)
                }
            } catch (visionErr: any) {
                console.error(`⚠️ [PROCESS] Vision embedding failed (non-fatal):`, visionErr.message || visionErr)
                // Non-fatal: continue processing without image embeddings
            }
        }

        // STEP 7: Extract Graph Entities and Relationships (Graph RAG)
        const msgGraph = 'Mengekstrak entitas dan hubungan graf pengetahuan...'
        await updateProcessingLog(contentId, 'processing', msgGraph, 95)

        try {
            const textToExtract = rawText.slice(0, 30000) // limit input for GraphRAG
            const prompt = `Extract key entities and their relationships from the following text to build a Knowledge Graph.
Return a valid JSON object with the following structure:
{
  "entities": [
    { "name": "...", "type": "PERSON | ORGANIZATION | LOCATION | CONCEPT | EVENT", "description": "..." }
  ],
  "relationships": [
    { "source_entity": "name of source entity", "target_entity": "name of target entity", "relationship": "WORKS_FOR | IS_LOCATED_IN | RELATED_TO | etc", "description": "..." }
  ]
}
Ensure entity names in relationships perfectly match the names in the entities array. Keep descriptions brief.

Text:
${textToExtract}`

            const graphJsonStr = await ai.generateCompletion(prompt, { jsonMode: true })
            const graphData = JSON.parse(graphJsonStr)

            // Save Entities
            const entityMap = new Map<string, string>() // name -> id
            if (graphData.entities && Array.isArray(graphData.entities)) {
                for (const ent of graphData.entities) {
                    if (!ent.name) continue
                    const created = await prisma.contentEntity.create({
                        data: {
                            content_id: contentId,
                            name: ent.name,
                            type: ent.type || 'CONCEPT',
                            description: ent.description
                        }
                    })
                    entityMap.set(ent.name, created.id)
                }
            }

            // Save Relationships
            if (graphData.relationships && Array.isArray(graphData.relationships)) {
                for (const rel of graphData.relationships) {
                    const sourceId = entityMap.get(rel.source_entity)
                    const targetId = entityMap.get(rel.target_entity)
                    if (sourceId && targetId) {
                        await prisma.contentRelationship.create({
                            data: {
                                content_id: contentId,
                                source_entity_id: sourceId,
                                target_entity_id: targetId,
                                relationship: rel.relationship || 'RELATED_TO',
                                description: rel.description
                            }
                        })
                    }
                }
            }
            logger.info(`Graph extraction completed for article ${contentId}. Entities: ${entityMap.size}.`)
        } catch (graphErr: any) {
            console.error(`⚠️ [PROCESS] Graph Extraction failed for content (non-fatal):`, graphErr.message || graphErr)
            // Non-fatal, do not break document processing just because graph failed
        }

        // STEP 8: Mark document as processed
        const msgDone = 'Pemrosesan artikel selesai!'
        const finalEntry = { time: new Date().toISOString(), message: msgDone, progress: 100 }
        const finalEntryJson = JSON.stringify([finalEntry])

        // Use raw SQL for new columns + regular update for existing ones
        await prisma.$executeRaw`
            UPDATE contents
            SET is_processed = true,
                processing_status = 'completed',
                processing_log = COALESCE(processing_log, '[]'::jsonb) || ${finalEntryJson}::jsonb,
                processing_error = NULL,
                embedding_version = embedding_version + 1
            WHERE id = ${contentId}
        `

        // STEP 9: Log AI usage
        const estimatedTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0) * 2
        await prisma.aIUsageLog.create({
            data: {
                organization_id: content.organization_id,
                user_id: content.author_id,
                action_type: 'AUTO_TAG',
                tokens_used: estimatedTokens,
                model_used: ai.embeddingModel,
            },
        })

        logger.info(
            `Article ${contentId} processed successfully (${chunks.length} chunks, model: ${ai.providerName})`
        )

    } catch (err) {
        console.error(`\n❌ [PROCESS] AI processing FAILED for Article ${contentId}:`, err)
        logger.error(`AI processing failed for Article ${contentId}`, err)
        const errMsg = err instanceof Error ? err.message : 'Unknown processing error'

        const errEntry = { time: new Date().toISOString(), message: `Error: ${errMsg}`, progress: 0 }
        const errEntryJson = JSON.stringify([errEntry])

        await prisma.$executeRaw`
            UPDATE contents
            SET is_processed = false,
                processing_status = 'failed',
                processing_log = COALESCE(processing_log, '[]'::jsonb) || ${errEntryJson}::jsonb,
                processing_error = ${errMsg}
            WHERE id = ${contentId}
        `
    }
}
