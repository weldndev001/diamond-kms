// app/api/ai/chat-content/route.ts
// Single-article RAG chat: embed question → cosine search this article's chunks
// + linked source_documents chunks → stream answer
import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import { logger } from '@/lib/logging/redact'

export const maxDuration = 60

export async function POST(req: NextRequest) {
    try {
        const { contentId, question, history = [] } = await req.json()

        if (!contentId || !question) {
            return new Response(JSON.stringify({ error: 'Missing contentId or question' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Fetch content to get org_id AND source_documents (linked files)
        const content = await prisma.content.findUnique({
            where: { id: contentId },
            select: {
                id: true,
                organization_id: true,
                title: true,
                body: true,
                is_processed: true,
                source_documents: true,
            },
        })

        if (!content) {
            return new Response(JSON.stringify({ error: 'Article not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Get AI service
        const ai = await getAIServiceForOrg(content.organization_id)

        // Try to find relevant chunks (may be empty if not processed yet)
        let ragContext = ''
        const docTitle = content.title

        // Embed the question once for all searches
        const questionEmbedding = await ai.generateEmbedding(question)
        const vectorStr = JSON.stringify(questionEmbedding)

        if (content.is_processed) {
            // Cosine similarity search — top 4 chunks from THIS article only
            const relevantChunks = await prisma.$queryRawUnsafe<
                {
                    chunk_id: string
                    content: string
                    similarity: number
                }[]
            >(
                `SELECT
                    cc.id AS chunk_id,
                    cc.content,
                    1 - (cc.embedding <=> $1::vector) AS similarity
                FROM content_chunks cc
                WHERE cc.content_id = $2
                  AND cc.embedding IS NOT NULL
                ORDER BY similarity DESC
                LIMIT 4`,
                vectorStr,
                contentId
            )

            ragContext = relevantChunks
                .map((c, i) => `[Bagian Artikel ${i + 1}]\n${c.content}`)
                .join('\n\n---\n\n')

            // Fetch Graph Entities & Relationships
            const entities = await prisma.contentEntity.findMany({
                where: { content_id: contentId },
                take: 15
            })
            const relationships = await prisma.contentRelationship.findMany({
                where: { content_id: contentId },
                include: { source_entity: true, target_entity: true },
                take: 30
            })

            if (entities.length > 0 || relationships.length > 0) {
                let graphContext = `[KNOWLEDGE GRAPH ENTITAS & RELASI]\n`
                if (entities.length > 0) {
                    graphContext += `Entitas Utama:\n` + entities.map((e: any) => `- ${e.name} (${e.type}): ${e.description || ''}`).join('\n') + '\n\n'
                }
                if (relationships.length > 0) {
                    graphContext += `Relasi Hubungan:\n` + relationships.map((r: any) => `- ${r.source_entity.name} [${r.relationship}] ${r.target_entity.name}${r.description ? ` (${r.description})` : ''}`).join('\n') + '\n\n'
                }
                ragContext = graphContext + `\n[KUTIPAN TEKS ARTIKEL (Vector Search)]\n` + ragContext
            }
        }

        // ── LINKED SOURCE DOCUMENTS: Search document_chunks from linked files ──
        let linkedDocContext = ''
        const sourceDocIds = content.source_documents || []

        if (sourceDocIds.length > 0) {
            try {
                // Find which of these documents are actually processed
                const processedDocs = await prisma.document.findMany({
                    where: {
                        id: { in: sourceDocIds },
                        is_processed: true,
                    },
                    select: { id: true, file_name: true, ai_title: true },
                })

                if (processedDocs.length > 0) {
                    const processedDocIds = processedDocs.map(d => d.id)
                    const docIdList = processedDocIds.map(id => `'${id}'`).join(',')

                    // Vector search across linked document chunks
                    const linkedChunks = await prisma.$queryRawUnsafe<
                        {
                            chunk_id: string
                            document_id: string
                            doc_title: string
                            content: string
                            similarity: number
                            page_start: number
                            page_end: number
                        }[]
                    >(
                        `SELECT
                            dc.id AS chunk_id,
                            d.id AS document_id,
                            COALESCE(d.ai_title, d.file_name) AS doc_title,
                            dc.content,
                            1 - (dc.embedding <=> $1::vector) AS similarity,
                            dc.page_number AS page_start,
                            COALESCE(dc.page_end, dc.page_number) AS page_end
                        FROM document_chunks dc
                        JOIN documents d ON dc.document_id = d.id
                        WHERE dc.document_id IN (${docIdList})
                          AND dc.embedding IS NOT NULL
                        ORDER BY similarity DESC
                        LIMIT 6`,
                        vectorStr
                    )

                    // Filter by minimum similarity threshold
                    const threshold = 0.35
                    const relevantLinkedChunks = linkedChunks.filter(c => c.similarity > threshold)

                    if (relevantLinkedChunks.length > 0) {
                        linkedDocContext = '\n\n[KONTEKS DARI DOKUMEN SUMBER TERLAMPIR]\n' +
                            relevantLinkedChunks
                                .map((c, i) => {
                                    const pageInfo = c.page_start
                                        ? ` (Hal. ${c.page_start}${c.page_end !== c.page_start ? `-${c.page_end}` : ''})`
                                        : ''
                                    return `[Dokumen: ${c.doc_title}${pageInfo}]\n${c.content}`
                                })
                                .join('\n\n---\n\n')

                        console.log(`[CHAT-CONTENT] Found ${relevantLinkedChunks.length} relevant chunks from ${processedDocs.length} linked document(s)`)
                    }

                    // Also fetch graph entities from linked documents
                    const linkedEntities = await prisma.documentEntity.findMany({
                        where: { document_id: { in: processedDocIds } },
                        take: 15
                    })
                    const linkedRelationships = await prisma.documentRelationship.findMany({
                        where: { document_id: { in: processedDocIds } },
                        include: { source_entity: true, target_entity: true },
                        take: 20
                    })

                    if (linkedEntities.length > 0 || linkedRelationships.length > 0) {
                        let linkedGraph = '\n\n[KNOWLEDGE GRAPH DARI DOKUMEN SUMBER]\n'
                        if (linkedEntities.length > 0) {
                            linkedGraph += `Entitas:\n` + linkedEntities.map((e: any) => `- ${e.name} (${e.type}): ${e.description || ''}`).join('\n') + '\n'
                        }
                        if (linkedRelationships.length > 0) {
                            linkedGraph += `Relasi:\n` + linkedRelationships.map((r: any) => `- ${r.source_entity.name} [${r.relationship}] ${r.target_entity.name}`).join('\n') + '\n'
                        }
                        linkedDocContext += linkedGraph
                    }
                }
            } catch (linkedErr) {
                console.warn('[CHAT-CONTENT] Failed to search linked document chunks:', linkedErr)
                // Non-fatal: continue without linked document context
            }
        }

        // ── FALLBACK: If no content chunks found, use raw body text ──
        if (!ragContext && content.body) {
            // Strip HTML and use raw text as fallback context
            const rawText = content.body
                .replace(/<[^>]*>?/gm, ' ')
                .replace(/\s\s+/g, ' ')
                .trim()
                .slice(0, 8000)
            if (rawText.length > 50) {
                ragContext = `[TEKS ARTIKEL LENGKAP (fallback)]\n${rawText}`
                console.log(`[CHAT-CONTENT] Using raw body fallback for "${docTitle}" (${rawText.length} chars)`)
            }
        }

        // Combine all contexts
        const fullContext = ragContext + linkedDocContext

        // System prompt scoped to this article + linked documents
        const hasLinkedDocs = linkedDocContext.length > 0
        const systemPrompt = `Anda adalah asisten AI yang membantu user memahami artikel Knowledge Base berjudul "${docTitle}"${hasLinkedDocs ? ' beserta dokumen sumber yang terlampir' : ''}.

ATURAN PENTING:
- Jawab pertanyaan berdasarkan konteks artikel dan dokumen sumber di bawah, yang mencakup potongan teks, dokumen terlampir, dan graf pengetahuan entitas + relasinya.
- Jika informasi tidak ditemukan secara eksplisit dari sumber manapun, katakan "Informasi ini tidak ditemukan dalam artikel maupun dokumen sumber."
- Berikan jawaban yang SERTA MERTA, ringkas, dan langsung ke intinya. DILARANG KERAS mengulang-ulang kalimat, poin, atau kesimpulan yang sama.
- JIKA Anda sudah memberikan kesimpulan atau ringkasan, SELESAIKAN jawaban Anda dan JANGAN menulis ulang kesimpulan.
- Ketika menjawab berdasarkan dokumen sumber, sebutkan nama dokumen dan halaman jika tersedia.

KONTEKS DARI ARTIKEL${hasLinkedDocs ? ' DAN DOKUMEN SUMBER' : ''}:
${fullContext || 'Tidak ada teks artikel yang diproses AI ditemukan.'}`

        // Build chat prompt
        const historyText = (history as { role: string; content: string }[])
            .slice(-8)
            .map((m) => `${m.role === 'user' ? 'User' : 'Asisten'}: ${m.content}`)
            .join('\n')

        const fullPrompt = historyText
            ? `${historyText}\n\nUser: ${question}`
            : question

        // Stream response
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    await ai.streamCompletion(
                        fullPrompt,
                        systemPrompt,
                        (chunk: string) => {
                            try {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
                                )
                            } catch { /* client disconnected */ }
                        }
                    )
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
                } catch (err) {
                    logger.error('Article chat streaming error:', err)
                    const msg = err instanceof Error ? err.message : 'Unknown error'
                    const friendlyMsg = msg.includes('504')
                        ? 'Server AI mengalami Timeout (504). Beban artikel terlalu panjang atau server sedang sibuk.'
                        : msg
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ error: friendlyMsg })}\n\n`)
                    )
                } finally {
                    try { controller.close() } catch { /* already closed */ }
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        })
    } catch (err) {
        logger.error('Article chat error:', err)
        return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}
