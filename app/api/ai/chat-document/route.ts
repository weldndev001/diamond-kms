// app/api/ai/chat-document/route.ts
// Single-document RAG chat: embed question → cosine search ONLY this doc's chunks → stream answer
import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import { logger } from '@/lib/logging/redact'

export const maxDuration = 60

export async function POST(req: NextRequest) {
    try {
        const { documentId, question, history = [], useVector = true, useGraph = true, useRerank = false } = await req.json()

        if (!documentId || !question) {
            return new Response(JSON.stringify({ error: 'Missing documentId or question' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Validation: At least Vector or Rerank must be active if useVector was explicitly passed
        if (!useVector && !useRerank) {
            return new Response(JSON.stringify({ error: 'Setidaknya Vektor atau Reranking harus aktif.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Fetch document to get org_id
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            select: {
                id: true,
                organization_id: true,
                ai_title: true,
                file_name: true,
                ai_summary: true,
                is_processed: true,
            },
        })

        if (!document) {
            return new Response(JSON.stringify({ error: 'Document not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Get AI service
        const ai = await getAIServiceForOrg(document.organization_id)

        // Try to find relevant chunks (may be empty if not processed yet)
        let context = ''
        const docTitle = document.ai_title || document.file_name

        if (document.is_processed) {
            let relevantChunks: any[] = []

            if (useVector || useRerank) {
                // Embed the question
                const questionEmbedding = await ai.generateEmbedding(question)
                const vectorStr = JSON.stringify(questionEmbedding)

                // Cosine similarity search — top 15 chunks (more if we want to rerank)
                const limit = useRerank ? 15 : 6
                relevantChunks = await prisma.$queryRawUnsafe<
                    {
                        chunk_id: string
                        content: string
                        similarity: number
                        page_start: number
                        page_end: number
                    }[]
                >(
                    `SELECT
                        dc.id AS chunk_id,
                        dc.content,
                        1 - (dc.embedding <=> $1::vector) AS similarity,
                        dc.page_number AS page_start,
                        COALESCE(dc.page_end, dc.page_number) AS page_end
                    FROM document_chunks dc
                    WHERE dc.document_id = $2
                      AND dc.embedding IS NOT NULL
                    ORDER BY similarity DESC
                    LIMIT $3`,
                    vectorStr,
                    documentId,
                    limit
                )

                // Reranking if enabled
                if (useRerank && relevantChunks.length > 0) {
                    try {
                        const documents = relevantChunks.map(c => c.content)
                        const reranked = await ai.rerank(question, documents)
                        
                        relevantChunks = reranked.map((r: any) => {
                            const original = relevantChunks[r.index]
                            return { ...original, similarity: r.score }
                        }).sort((a: any, b: any) => b.similarity - a.similarity).slice(0, 6)
                    } catch (err) {
                        console.warn('[CHAT-DOCUMENT] Reranking failed, fallback to vector', err)
                    }
                } else {
                    relevantChunks = relevantChunks.slice(0, 6)
                }

                context = relevantChunks
                    .map(
                        (c, i) =>
                            `[Bagian ${i + 1}, Hal. ${c.page_start}${c.page_end !== c.page_start ? `-${c.page_end}` : ''}]\n${c.content}`
                    )
                    .join('\n\n---\n\n')
            }

            // Fetch Graph Entities & Relationships
            if (useGraph) {
                const entities = await prisma.documentEntity.findMany({
                    where: { document_id: documentId },
                    take: 15
                })
                const relationships = await prisma.documentRelationship.findMany({
                    where: { document_id: documentId },
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
                    context = graphContext + (context ? `\n[KUTIPAN TEKS (Vector Search)]\n` + context : '')
                }
            }
        }

        // System prompt scoped to this document
        const systemPrompt = `Anda adalah asisten AI yang membantu user memahami dokumen "${docTitle}".
${document.ai_summary ? `Ringkasan dokumen: ${document.ai_summary}` : ''}

ATURAN PENTING:
- Jawab pertanyaan HANYA berdasarkan konteks dokumen di bawah, yang mencakup ringkasan teks dan graf pengetahuan entitas + relasinya.
- Jika informasi tidak ditemukan, katakan "Informasi ini tidak ditemukan dalam dokumen ini."
- Sebutkan bagian/halaman atau nama entitas relevan saat menjawab.
- Berikan jawaban yang SERTA MERTA, ringkas, dan langsung ke intinya. DILARANG KERAS mengulang-ulang kalimat, poin, atau kesimpulan yang sama.
- JIKA Anda sudah memberikan kesimpulan atau ringkasan, SELESAIKAN jawaban Anda dan JANGAN menulis ulang kesimpulan/catatan tersebut.

KONTEKS DARI DOKUMEN:
${context || 'Tidak ada bagian dokumen atau entitas yang relevan ditemukan.'}`

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
                    logger.error('Document chat streaming error:', err)
                    const msg = err instanceof Error ? err.message : 'Unknown error'
                    // check if msg contains 504
                    const friendlyMsg = msg.includes('504')
                        ? 'Server AI mengalami Timeout (504). Beban dokumen terlalu panjang atau server sedang sibuk memproses model berat.'
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
        logger.error('Document chat error:', err)
        return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}
