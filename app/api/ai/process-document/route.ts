// app/api/ai/process-document/route.ts
// REPLACES dummy simulateAIProcessing() with real AI pipeline
// Pipeline: download file → extract text → AI metadata → chunk → embed → save
// + Vision Embedding: extract and embed images from PDFs for cross-modal retrieval
// NOW: writes progress to DB so clients can poll for status
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logging/redact'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import { extractPDFText, extractPlainText, extractPDFImages } from '@/lib/ai/pdf-extractor'
import { chunkDocument } from '@/lib/ai/chunker'
import { env } from '@/lib/env'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'

export const maxDuration = 300 // Allow up to 5 minutes for large videos/PDFs

// Helper to update processing log in DB
async function updateProcessingLog(
    documentId: string,
    status: string,
    message: string,
    progress: number
) {
    const newEntry = { time: new Date().toISOString(), message, progress }
    const entryJson = JSON.stringify([newEntry])
    // Use jsonb concatenation to prevent race conditions during concurrent updates
    await prisma.$executeRaw`
        UPDATE documents
        SET processing_status = ${status},
            processing_log = COALESCE(processing_log, '[]'::jsonb) || ${entryJson}::jsonb
        WHERE id = ${documentId}
    `
}

export async function POST(req: NextRequest) {
    // Security: accept calls from internal server actions only
    const secret = req.headers.get('x-internal-secret')
    if (secret !== env.CRON_SECRET) {
        return ApiResponse.forbidden('process-document endpoint')
    }

    let documentId: string
    try {
        const body = await req.json()
        documentId = body.documentId
    } catch {
        return ApiResponse.validationError({ body: 'Invalid JSON' })
    }
    if (!documentId) {
        return ApiResponse.validationError({ documentId: 'required' })
    }

    // Fetch document from DB
    const document = await prisma.document.findUnique({
        where: { id: documentId },
    })

    if (!document) {
        return ApiResponse.notFound('Document')
    }

    // Run background processing and await it to prevent Vercel Serverless early termination
    try {
        await processDocumentInBackground(documentId, document)
    } catch (err) {
        logger.error(`Critical failure in background processing for ${documentId}:`, err)
    }

    return NextResponse.json({ success: true, message: 'Processing completed or failed' })
}

async function processDocumentInBackground(documentId: string, document: any) {
    // Reset status, error, and logs at the beginning to ensure a clean state
    try {
        await prisma.document.update({
            where: { id: documentId },
            data: {
                processing_status: 'processing',
                processing_error: null,
                processing_log: [] // Reset log for a clean start
            }
        })
    } catch (resetErr) {
        console.error(`❌ [PROCESS] Failed to reset document status:`, resetErr)
    }

    const fs = await import('fs')
    fs.appendFileSync('ai-debug.log', `[${new Date().toISOString()}] [PROCESS-BG] STARTED for ${documentId}\n`)
    console.log(`\n🔄 [PROCESS] Starting background processing for ${documentId} (${document.file_name})`)
    try {
        await updateProcessingLog(documentId, 'processing', 'Memulai pemrosesan dokumen...', 5)
        console.log(`✅ [PROCESS] DB log updated successfully for ${documentId}`)
    } catch (logErr) {
        console.error(`❌ [PROCESS] updateProcessingLog FAILED for ${documentId}:`, logErr)
        // Continue anyway — don't let log failure prevent processing
    }

    const sendEvent = (event: string, data: any) => {
        // Dummy function: SSE is no longer used, UI relies on DB polling
    }

    try {
        sendEvent('start', { message: 'Memulai pemrosesan dokumen...' })

        // STEP 1: Read file content
        const msg1 = 'Membaca dan mengekstrak teks dari file...'
        sendEvent('progress', { step: 'extracting', message: msg1, progress: 10 })
        await updateProcessingLog(documentId, 'processing', msg1, 10)

        let fileBuffer: Buffer | null = null
        let extractedText = ''

        try {
            const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL_URL
            const uploadDir = IS_VERCEL ? '/tmp/uploads' : (env.UPLOAD_DIR || './uploads')
            
            const safeFilePath = document.file_path.replace(/\\/g, '/').replace(/\.\./g, '')
            const fullPath = join(uploadDir, 'documents', safeFilePath)

            if (existsSync(fullPath)) {
                fileBuffer = await readFile(fullPath)
                console.log(`✅ [PROCESS] Read file locally: ${fullPath} (${fileBuffer.length} bytes)`)
            } else {
                console.log(`⚠️ [PROCESS] File not found locally: ${fullPath}`)
                throw new Error('Local file not found')
            }
        } catch (storageErr: any) {
            console.error(`❌ [PROCESS] Local file read FAILED:`, storageErr?.message)
            logger.warn('Local file read failed', storageErr)
        }

        // STEP 2: Extract text based on file type
        const isPDF = document.mime_type === 'application/pdf'
        const isText = ['text/plain', 'text/markdown', 'text/csv', 'text/x-sql', 'application/sql', 'text/sql'].includes(
            document.mime_type
        ) || /\.(txt|md|csv|sql|json|yml|yaml|ini|conf|log)$/i.test(document.file_name)
        const isDocx = document.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                       document.file_name.toLowerCase().endsWith('.docx')
        const isPptx = document.mime_type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
                       document.file_name.toLowerCase().endsWith('.pptx') ||
                       document.file_name.toLowerCase().endsWith('.ppt')
        const isXlsx = document.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                       document.file_name.toLowerCase().endsWith('.xlsx')
        const isAudio = document.mime_type.startsWith('audio/') || 
                       /\.(mp3|wav|ogg|m4a)$/i.test(document.file_name)
        const isVideo = document.mime_type.startsWith('video/') ||
                       /\.(mp4|mov|avi|mkv|webm|flv|wmv)$/i.test(document.file_name)
        const isImage = document.mime_type.startsWith('image/') ||
                       /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i.test(document.file_name)

        let pages: { pageNum: number; text: string }[]
        let pageCount: number
        let videoFrames: import('@/lib/ai/video-extractor').ExtractedVideoFrame[] = []
        let compressedImageBase64: string | null = null // For image documents

        if (fileBuffer && isPDF) {
            const extracted = await extractPDFText(fileBuffer)
            extractedText = extracted.fullText
            pages = extracted.pages
            pageCount = extracted.pageCount
        } else if (fileBuffer && isDocx) {
            const { extractDocxText } = await import('@/lib/ai/pdf-extractor')
            const extracted = await extractDocxText(fileBuffer, document.file_name)
            extractedText = extracted.fullText
            pages = extracted.pages
            pageCount = extracted.pageCount
        } else if (fileBuffer && isImage) {
            // Image processing: compress with sharp then analyze with AI Vision
            sendEvent('progress', { step: 'extracting', message: 'Mengompresi dan menganalisis gambar dengan AI Vision...', progress: 12 })
            await updateProcessingLog(documentId, 'processing', 'Mengompresi gambar sebelum analisis AI...', 12)

            try {
                const sharp = require('sharp')
                const imgMeta = await sharp(fileBuffer).metadata()
                const origWidth = imgMeta.width || 0
                const origHeight = imgMeta.height || 0
                console.log(`🖼️ [PROCESS] Original image: ${origWidth}x${origHeight} (${fileBuffer.length} bytes)`)

                // Compress: resize to max 1024px on longest side, convert to JPEG 80%
                const MAX_DIM = 1024
                let sharpPipeline = sharp(fileBuffer).rotate() // auto-rotate based on EXIF
                if (origWidth > MAX_DIM || origHeight > MAX_DIM) {
                    sharpPipeline = sharpPipeline.resize({
                        width: MAX_DIM,
                        height: MAX_DIM,
                        fit: 'inside',
                        withoutEnlargement: true,
                    })
                }
                const compressedBuffer = await sharpPipeline
                    .jpeg({ quality: 80, mozjpeg: true })
                    .toBuffer()

                const compressedMeta = await sharp(compressedBuffer).metadata()
                console.log(`🖼️ [PROCESS] Compressed image: ${compressedMeta.width}x${compressedMeta.height} (${compressedBuffer.length} bytes, saved ${Math.round((1 - compressedBuffer.length / fileBuffer.length) * 100)}%)`)

                compressedImageBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`

                await updateProcessingLog(documentId, 'processing', `Gambar dikompresi: ${origWidth}x${origHeight} → ${compressedMeta.width}x${compressedMeta.height}. Menganalisis isi gambar...`, 18)

                // Use AI to describe the image content
                const tempAi = await getAIServiceForOrg(document.organization_id)
                if (tempAi.describeImage) {
                    let description = await tempAi.describeImage(compressedImageBase64, document.file_name)
                    
                    // Summarize if too long to avoid Embedding 504 on Olla sidecar
                    if (description.length > 1000) {
                        console.log(`🖼️ [PROCESS] Deskripsi terlalu panjang (${description.length} karakter), meringkas untuk embedding...`)
                        try {
                            const summary = await tempAi.generateCompletion(
                                `Ringkas deskripsi visual berikut menjadi maksimal 2 paragraf padat yang mengandung poin-poin kunci untuk indeks pencarian:\n\n${description}`,
                                { 
                                    systemPrompt: 'Anda adalah pakar indexing. Ringkas deskripsi visual menjadi sangat padat namun tetap informatif.',
                                    maxTokens: 500 
                                }
                            )
                            description = summary
                            console.log(`🖼️ [PROCESS] Deskripsi berhasil diringkas menjadi ${description.length} karakter.`)
                        } catch (sumErr) {
                            console.error(`⚠️ [PROCESS] Gagal meringkas deskripsi, menggunakan versi asli.`, sumErr)
                        }
                    }

                    extractedText = `[Dokumen Gambar: ${document.file_name}]\n[Dimensi: ${origWidth}x${origHeight}px]\n\nDeskripsi Visual:\n${description}`
                    console.log(`🖼️ [PROCESS] AI image description finalized: ${description.length} chars`)
                } else {
                    extractedText = `[Dokumen Gambar: ${document.file_name}]\n[Dimensi: ${origWidth}x${origHeight}px]\n[Ukuran: ${fileBuffer.length} bytes]\n\nGambar ini diupload sebagai dokumen. Deskripsi visual tidak tersedia karena provider AI tidak mendukung analisis gambar.`
                    console.log(`⚠️ [PROCESS] AI provider does not support describeImage, using basic metadata`)
                }
            } catch (imgErr: any) {
                console.error(`❌ [PROCESS] Image processing failed:`, imgErr?.message)
                extractedText = `[Dokumen Gambar: ${document.file_name}]\nGagal memproses gambar: ${imgErr?.message || 'Unknown error'}`
            }

            pages = [{ pageNum: 1, text: extractedText }]
            pageCount = 1
        } else if (fileBuffer && isVideo) {
            // Video processing: extract audio transcription + key frame analysis
            const { extractVideoContent } = await import('@/lib/ai/video-extractor')
            sendEvent('progress', { step: 'extracting', message: 'Memproses file video (ekstraksi audio & frame)...', progress: 12 })
            await updateProcessingLog(documentId, 'processing', 'Memproses file video dengan AI multimodal...', 12)
            const extracted = await extractVideoContent(
                fileBuffer,
                document.file_name,
                document.mime_type,
                document.organization_id,
                async (message, progress) => {
                    sendEvent('progress', { step: 'extracting', message, progress })
                    await updateProcessingLog(documentId, 'processing', message, progress)
                }
            )
            extractedText = extracted.fullText
            pages = extracted.pages
            pageCount = extracted.pageCount
            videoFrames = extracted.frames
            console.log(`🎬 [PROCESS] Video processed: ${extracted.durationSeconds.toFixed(0)}s duration, ${extracted.frames.length} frames, ${extractedText.length} chars`)
        } else if (fileBuffer && isAudio) {
            const { extractAudioText } = await import('@/lib/ai/audio-extractor')
            sendEvent('progress', { step: 'extracting', message: 'Mentranskripsi suara ke teks...', progress: 15 })
            await updateProcessingLog(documentId, 'processing', 'Mentranskripsi suara ke teks menggunakan AI...', 15)
            const extracted = await extractAudioText(fileBuffer, document.file_name, document.mime_type, document.organization_id)
            extractedText = extracted.fullText
            pages = extracted.pages
            pageCount = extracted.pageCount
        } else if (fileBuffer && isPptx) {
            const { extractPptxText } = await import('@/lib/ai/pdf-extractor')
            sendEvent('progress', { step: 'extracting', message: 'Mengekstrak teks dari file presentasi PowerPoint...', progress: 12 })
            await updateProcessingLog(documentId, 'processing', 'Mengekstrak teks dari slide PowerPoint...', 12)
            const extracted = await extractPptxText(fileBuffer, document.file_name)
            extractedText = extracted.fullText
            pages = extracted.pages
            pageCount = extracted.pageCount
            console.log(`📊 [PROCESS] PPTX processed: ${extracted.pageCount} slides, ${extractedText.length} chars`)
        } else if (fileBuffer && isXlsx) {
            const { extractXlsxText } = await import('@/lib/ai/pdf-extractor')
            const extracted = await extractXlsxText(fileBuffer, document.file_name)
            extractedText = extracted.fullText
            pages = extracted.pages
            pageCount = extracted.pageCount
        } else if (fileBuffer && isText) {
            const extracted = extractPlainText(fileBuffer, document.file_name)
            extractedText = extracted.fullText
            pages = extracted.pages
            pageCount = extracted.pageCount
        } else {
            extractedText = `Document: ${document.file_name} (${document.mime_type}, ${document.file_size} bytes). Content extraction not available for this file type.`
            pages = [{ pageNum: 1, text: extractedText }]
            pageCount = 1
        }

        console.log(`✅ [PROCESS] Extracted ${pageCount} pages, ${extractedText.length} chars from ${document.file_name}`)

        // STEP 3: Get AI service for this organization
        const msg3 = 'Membuat ringkasan, judul, dan kategori dengan AI...'
        sendEvent('progress', { step: 'metadata', message: msg3, progress: 30 })
        await updateProcessingLog(documentId, 'processing', msg3, 30)

        const fs = await import('fs')
        fs.appendFileSync('ai-debug.log', `[${new Date().toISOString()}] Calling getAIServiceForOrg for ${document.organization_id}\n`)
        const ai = await getAIServiceForOrg(document.organization_id)
        await updateProcessingLog(documentId, 'processing', `Menggunakan provider AI: ${ai.providerName} (${ai.embeddingModel})`, 35)
        fs.appendFileSync('ai-debug.log', `[${new Date().toISOString()}] Got AI service: ${ai.providerName}\n`)
        console.log(`✅ [PROCESS] Got AI service: ${ai.providerName}, embedding: ${ai.embeddingModel}`)

        // STEP 4: Generate metadata (title, summary, tags)
        const metadata = await ai.generateDocumentMetadata({
            fileBuffer:
                ai.providerName === 'google-gemini' && isPDF && fileBuffer
                    ? fileBuffer
                    : undefined,
            imageBase64:
                ai.providerName === 'google-gemini' && isImage && compressedImageBase64
                    ? compressedImageBase64
                    : undefined,
            text:
                (ai.providerName !== 'google-gemini' || (!isPDF && !isImage) || (!fileBuffer && !compressedImageBase64))
                    ? extractedText.slice(0, 30000)
                    : undefined,
            fileName: document.file_name,
        })

        // STEP 5: Update Document with AI metadata
        await prisma.document.update({
            where: { id: documentId },
            data: {
                ai_title: metadata.title,
                ai_summary: metadata.summary,
                ai_tags: metadata.tags,
                embedding_model: ai.embeddingModel,
            },
        })

        // STEP 6: Chunk document semantically
        const msg6 = 'Memotong dokumen menjadi beberapa bagian indeks...'
        sendEvent('progress', { step: 'chunking', message: msg6, progress: 50 })
        await updateProcessingLog(documentId, 'processing', msg6, 50)

        const chunks = chunkDocument(pages)
        logger.info(`Created ${chunks.length} chunks for ${documentId}`)

        // STEP 7: Remove old chunks if re-processing
        await prisma.documentChunk.deleteMany({
            where: { document_id: documentId },
        })

        // STEP 8: Embed each chunk and save to DB
        const pLimit = (await import('p-limit')).default
        const limit = pLimit(4) // Max 4 concurrent embedding requests to prevent crashing local Ollama

        const totalChunks = chunks.length
        let processedChunks = 0

        await Promise.all(
            chunks.map((chunk, i) =>
                limit(async () => {
                    processedChunks++
                    const currentProgress = 50 + Math.floor((processedChunks / totalChunks) * 40)
                    const embMsg = `Membuat vektor embeddings (Bagian ${processedChunks}/${totalChunks})...`

                    // Check if cancelled
                    const currentDoc = await prisma.document.findUnique({
                        where: { id: documentId },
                        select: { processing_status: true }
                    })
                    if (currentDoc?.processing_status === 'failed') {
                        throw new Error('Proses dihentikan oleh pengguna.')
                    }

                    // Only send progress updates for every 3rd chunk to avoid overwhelming the client/DB
                    if (processedChunks === 0 || processedChunks === totalChunks - 1 || processedChunks % 3 === 0) {
                        sendEvent('progress', { step: 'embedding', message: embMsg, progress: currentProgress })
                        await updateProcessingLog(documentId, 'processing', embMsg, currentProgress)
                    }

                    const embedding = await ai.generateEmbedding(chunk.content)
                    const embeddingString = `[${embedding.join(',')}]`
                    try {
                        await prisma.$executeRaw`
                            INSERT INTO document_chunks
                            (id, document_id, chunk_index, content, embedding, token_count, page_number, page_end, created_at)
                            VALUES
                            (gen_random_uuid()::text, ${documentId}, ${chunk.chunkIndex}, ${chunk.content}, CAST(${embeddingString} AS vector), ${chunk.tokenCount}, ${chunk.pageStart}, ${chunk.pageEnd}, NOW())
                        `
                    } catch (dbErr: any) {
                        console.error(`❌ [PROCESS] DB Insert FAILED for chunk ${i}:`, dbErr.message)
                        throw new Error(`Database Error: ${dbErr.message}`)
                    }
                    // Removed redundant processedChunks++ to fix 100%+ progress bug
                })
            )
        )

        const msgFinal = 'Merapikan dan menyimpan hasil pemrosesan...'
        sendEvent('progress', { step: 'finalizing', message: msgFinal, progress: 90 })
        await updateProcessingLog(documentId, 'processing', msgFinal, 90)

        // STEP 8.3: Vision Embedding — embed images from document (experimental)
        if (ai.generateImageEmbedding && ai.visionEmbedModel) {
            const msgVision = 'Membuat vektor embedding gambar dengan Vision AI (eksperimental)...'
            await updateProcessingLog(documentId, 'processing', msgVision, 92)

            try {
                // 8.3a: For uploaded image documents — embed the compressed image directly
                if (isImage && compressedImageBase64) {
                    console.log(`🖼️ [PROCESS] Embedding uploaded image document "${document.file_name}"`)

                    try {
                        const embedding = await ai.generateImageEmbedding!(compressedImageBase64)
                        const embeddingString = `[${embedding.join(',')}]`
                        const imgContent = `[Gambar Utama] Dokumen gambar "${document.file_name}"`

                        await prisma.$executeRaw`
                            INSERT INTO document_chunks
                            (id, document_id, chunk_index, content, image_embedding, token_count, page_number, page_end, chunk_type, image_source, created_at)
                            VALUES
                            (gen_random_uuid()::text, ${documentId}, ${1000}, ${imgContent}, CAST(${embeddingString} AS vector), ${0}, ${1}, ${1}, 'image', ${'Gambar Utama'}, NOW())
                        `
                        console.log(`✅ [PROCESS] Uploaded image embedded successfully for "${document.file_name}"`)
                    } catch (imgEmbErr) {
                        console.error(`⚠️ [PROCESS] Failed to embed uploaded image:`, imgEmbErr)
                    }
                }

                // 8.3b: For PDF documents — extract and embed images from PDF pages
                let pdfImages: import('@/lib/ai/pdf-extractor').ExtractedPDFImage[] = []

                if (isPDF && fileBuffer) {
                    pdfImages = await extractPDFImages(fileBuffer, 10)
                }

                if (pdfImages.length > 0) {
                    console.log(`🖼️ [PROCESS] Embedding ${pdfImages.length} PDF images for "${document.file_name}"`)

                    const pLimit2 = (await import('p-limit')).default
                    const imgLimit = pLimit2(2)

                    await Promise.all(
                        pdfImages.map((pdfImg, i) =>
                            imgLimit(async () => {
                                try {
                                    const embedding = await ai.generateImageEmbedding!(pdfImg.base64)
                                    const embeddingString = `[${embedding.join(',')}]`
                                    const imgContent = `[${pdfImg.label}] Gambar dalam dokumen "${document.file_name}"`

                                    await prisma.$executeRaw`
                                        INSERT INTO document_chunks
                                        (id, document_id, chunk_index, content, image_embedding, token_count, page_number, page_end, chunk_type, image_source, created_at)
                                        VALUES
                                        (gen_random_uuid()::text, ${documentId}, ${1000 + i}, ${imgContent}, CAST(${embeddingString} AS vector), ${0}, ${pdfImg.pageNum}, ${pdfImg.pageNum}, 'image', ${pdfImg.label}, NOW())
                                    `
                                    console.log(`✅ [PROCESS] Image chunk saved: ${pdfImg.label}`)
                                } catch (imgErr) {
                                    console.error(`⚠️ [PROCESS] Failed to embed PDF image ${i}:`, imgErr)
                                }
                            })
                        )
                    )

                    console.log(`✅ [PROCESS] ${pdfImages.length} PDF image chunks saved for "${document.file_name}"`)
                } else if (!isImage) {
                    console.log(`ℹ️ [PROCESS] No extractable images found in document "${document.file_name}"`)
                }
        } catch (visionErr: any) {
            console.error(`⚠️ [PROCESS] Vision embedding failed (non-fatal):`, visionErr.message || visionErr)
            // Continue even if vision embedding fails
        }
        }

        // STEP 8.4: Vision Embedding — embed video frames (if video document)
        if (ai.generateImageEmbedding && ai.visionEmbedModel && isVideo && videoFrames.length > 0) {
            const msgVideoVision = `Membuat vektor embedding ${videoFrames.length} frame video dengan Vision AI...`
            await updateProcessingLog(documentId, 'processing', msgVideoVision, 93)

            try {
                console.log(`🎬 [PROCESS] Embedding ${videoFrames.length} video frames for "${document.file_name}"`)

                const pLimit3 = (await import('p-limit')).default
                const frameLimit = pLimit3(2)

                await Promise.all(
                    videoFrames.map((frame, i) =>
                        frameLimit(async () => {
                            try {
                                const embedding = await ai.generateImageEmbedding!(frame.base64)
                                const embeddingString = `[${embedding.join(',')}]`
                                const frameContent = `[${frame.label}] Frame dari video "${document.file_name}"`

                                await prisma.$executeRaw`
                                    INSERT INTO document_chunks
                                    (id, document_id, chunk_index, content, image_embedding, token_count, page_number, page_end, chunk_type, image_source, created_at)
                                    VALUES
                                    (gen_random_uuid()::text, ${documentId}, ${2000 + i}, ${frameContent}, CAST(${embeddingString} AS vector), ${0}, ${1}, ${1}, 'image', ${frame.label}, NOW())
                                `
                                console.log(`✅ [PROCESS] Video frame chunk saved: ${frame.label}`)
                            } catch (frameErr) {
                                console.error(`⚠️ [PROCESS] Failed to embed video frame ${i}:`, frameErr)
                            }
                        })
                    )
                )

                console.log(`✅ [PROCESS] ${videoFrames.length} video frame chunks saved for "${document.file_name}"`)
            } catch (videoVisionErr: any) {
                console.error(`⚠️ [PROCESS] Video frame embedding failed (non-fatal):`, videoVisionErr.message || videoVisionErr)
            }
        }

        // STEP 8.5: Extract Graph Entities and Relationships (Graph RAG)
        const msgGraph = 'Mengekstrak entitas dan hubungan graf pengetahuan...'
        await updateProcessingLog(documentId, 'processing', msgGraph, 97)

        try {
            const textToExtract = extractedText.slice(0, 30000)
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
                    const created = await prisma.documentEntity.create({
                        data: {
                            document_id: documentId,
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
                        await prisma.documentRelationship.create({
                            data: {
                                document_id: documentId,
                                source_entity_id: sourceId,
                                target_entity_id: targetId,
                                relationship: rel.relationship || 'RELATED_TO',
                                description: rel.description
                            }
                        })
                    }
                }
            }
            logger.info(`Graph extraction completed for ${documentId}. Entities: ${entityMap.size}.`)
        } catch (graphErr: any) {
            console.error(`⚠️ [PROCESS] Graph Extraction failed (non-fatal):`, graphErr.message || graphErr)
            // Non-fatal, do not break document processing just because graph failed
        }

        // STEP 9: Mark document as processed
        const msgDone = 'Pemrosesan dokumen selesai!'
        const finalEntry = { time: new Date().toISOString(), message: msgDone, progress: 100 }
        const finalEntryJson = JSON.stringify([finalEntry])

        // Use raw SQL for new columns + regular update for existing ones
        await prisma.$executeRaw`
            UPDATE documents
            SET is_processed = true,
                processing_status = 'completed',
                processing_log = COALESCE(processing_log, '[]'::jsonb) || ${finalEntryJson}::jsonb,
                processing_error = NULL,
                embedding_version = embedding_version + 1
            WHERE id = ${documentId}
        `

        // STEP 10: Log AI usage
        const estimatedTokens =
            chunks.reduce((sum, c) => sum + c.tokenCount, 0) * 2
        await prisma.aIUsageLog.create({
            data: {
                organization_id: document.organization_id,
                user_id: document.uploaded_by,
                action_type: 'AUTO_TAG',
                tokens_used: estimatedTokens,
                model_used: ai.embeddingModel,
            },
        })

        logger.info(
            `Document ${documentId} processed successfully (${chunks.length} chunks, model: ${ai.providerName})`
        )

        sendEvent('progress', { step: 'done', message: msgDone, progress: 100 })
        sendEvent('done', { success: true, processed: true, chunks: chunks.length })

    } catch (err) {
        console.error(`\n❌ [PROCESS] AI processing FAILED for ${documentId}:`, err)
        logger.error(`AI processing failed for ${documentId}`, err)
        const errMsg = err instanceof Error ? err.message : 'Unknown processing error'

        const errEntry = { time: new Date().toISOString(), message: `Error: ${errMsg}`, progress: 0 }
        const errEntryJson = JSON.stringify([errEntry])

        await prisma.$executeRaw`
            UPDATE documents
            SET is_processed = false,
                processing_status = 'failed',
                processing_log = COALESCE(processing_log, '[]'::jsonb) || ${errEntryJson}::jsonb,
                processing_error = ${errMsg}
            WHERE id = ${documentId}
        `

        sendEvent('error', { message: errMsg })
    }
}
