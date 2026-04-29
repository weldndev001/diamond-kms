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

        // PARALLEL RETRIEVAL: Fetch vector context and graph context concurrently
        const [vectorContext, graphContext] = await Promise.all([
            // Task 1: Vector Search (if enabled)
            (async () => {
                if (!useVector && !useRerank) return '';
                
                try {
                    // Embed the question
                    const questionEmbedding = await ai.generateEmbedding(question)
                    const vectorStr = JSON.stringify(questionEmbedding)

                    // Initial search - top 15 if reranking, else top 7
                    const limit = useRerank ? 15 : 7
                    let chunks = await prisma.$queryRawUnsafe<
                        { id: string; content: string; similarity: number; page_number: number; page_end: number; }[]
                    >(
                        `SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity, page_number, page_end
                         FROM document_chunks
                         WHERE document_id = $2 AND embedding IS NOT NULL
                         ORDER BY similarity DESC LIMIT $3`,
                        vectorStr, documentId, limit
                    )

                    // Reranking
                    if (useRerank && chunks.length > 0) {
                        try {
                            const reranked = await ai.rerank(question, chunks.map(c => c.content))
                            chunks = reranked.map(r => chunks[r.index]).slice(0, 6)
                        } catch (err) {
                            console.warn('[CHAT-DOCUMENT] Reranking failed:', err)
                            chunks = chunks.slice(0, 6)
                        }
                    } else {
                        chunks = chunks.slice(0, 6)
                    }

                    return chunks.map((c, i) => 
                        `[Kutipan ${i + 1}, Hal. ${c.page_number}${c.page_end && c.page_end !== c.page_number ? `-${c.page_end}` : ''}]\n${c.content}`
                    ).join('\n\n')
                } catch (err) {
                    console.error('[CHAT-DOCUMENT] Vector search error:', err)
                    return ''
                }
            })(),

            // Task 2: Knowledge Graph (if enabled)
            (async () => {
                if (!useGraph) return '';
                try {
                    const [entities, relationships] = await Promise.all([
                        prisma.documentEntity.findMany({ where: { document_id: documentId }, take: 10 }),
                        prisma.documentRelationship.findMany({ 
                            where: { document_id: documentId }, 
                            include: { source_entity: true, target_entity: true },
                            take: 15 
                        })
                    ])

                    if (entities.length === 0 && relationships.length === 0) return '';

                    let graphText = '[GRAF PENGETAHUAN]\n'
                    if (entities.length > 0) {
                        graphText += 'Entitas: ' + entities.map(e => `${e.name} (${e.type})`).join(', ') + '\n'
                    }
                    if (relationships.length > 0) {
                        graphText += 'Hubungan: ' + relationships.map(r => `${r.source_entity.name} ${r.relationship} ${r.target_entity.name}`).join('; ') + '\n'
                    }
                    return graphText
                } catch (err) {
                    console.error('[CHAT-DOCUMENT] Graph retrieval error:', err)
                    return ''
                }
            })()
        ])

        const context = [graphContext, vectorContext].filter(Boolean).join('\n\n---\n\n')        // SYSTEM PROMPT: Optimized for performance and reasoning
        const docTitle = document.ai_title || document.file_name
        const systemPrompt = `Anda adalah pakar dokumen yang membantu memahami "${docTitle}".
${document.ai_summary ? `Ringkasan Dokumen: ${document.ai_summary}` : ''}

PANDUAN JAWABAN:
1. Jawab secara LANGSUNG di awal kalimat (misal: "Boleh", "Tidak boleh", "Ya", "Tidak").
2. Berikan alasan teknis/hukum berdasarkan KONTEKS setelah jawaban langsung tersebut.
3. Gunakan FORMAT BOLD (**teks**) untuk nomor pasal, jadwal, atau poin krusial.
4. Jika skenario user tidak tertulis secara literal, gunakan inferensi logis berdasarkan prinsip umum atau norma yang ada dalam dokumen.
5. Bedah pertanyaan berdasarkan variabel Subjek, Tindakan, Lokasi, dan Waktu untuk memastikan akurasi.

ATURAN KETAT:
- Jawab HANYA berdasarkan KONTEKS di bawah. Jika tidak ada, katakan: "Informasi tidak ditemukan dalam dokumen."
- Sebutkan nomor halaman/kutipan (misal: Pasal X atau Hal Y).
- Jawaban harus padat, akurat, dan tidak bertele-tele.

KONTEKS DOKUMEN:
${context || 'Konteks tidak tersedia.'}`

        // History handling: Limit to 6 turns
        const historyMsgs = (history as { role: string; content: string }[])
            .slice(-6)
            .map(m => `${m.role === 'user' ? 'User' : 'Asisten'}: ${m.content}`)
            .join('\n')
        
        const fullPrompt = historyMsgs 
            ? `Berikut adalah riwayat percakapan sebelumnya:\n${historyMsgs}\n\nPertanyaan Baru User: ${question}` 
            : question

        // Stream response with improved temperature for responsiveness
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    await ai.streamCompletion(
                        fullPrompt,
                        systemPrompt,
                        (chunk: string) => {
                            try {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
                            } catch { /* disconnect */ }
                        },
                        { temperature: 0.4 } // Balanced temperature for speed and logic
                    )
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
                } catch (err) {
                    logger.error('Chat stream error:', err)
                    const msg = err instanceof Error ? err.message : 'Unknown error'
                    const friendlyMsg = msg.includes('504') 
                        ? 'Server AI Timeout. Beban dokumen terlalu panjang atau server sedang sibuk.' 
                        : 'Gagal menghasilkan jawaban.'
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: friendlyMsg })}\n\n`))
                } finally {
                    try { controller.close() } catch { }
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
