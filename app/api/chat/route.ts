// app/api/chat/route.ts
// Server-Sent Events streaming endpoint for RAG chatbot
// Now with session persistence: saves messages to DB, auto-generates title
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { ragQuery, type ChatMessage } from '@/lib/ai/rag-pipeline'
import { hasPermission } from '@/lib/auth/permissions'
import { aiRateLimiter, checkRateLimit } from '@/lib/security/rate-limiter'
import { logger } from '@/lib/logging/redact'
import { env } from '@/lib/env'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const maxDuration = 60 // Allow up to 60s for streaming response

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (user as any).id

        // Get user profile
        const userGrp = await prisma.userGroup.findFirst({
            where: { user_id: userId, is_primary: true },
        })
        if (!userGrp) {
            return Response.json({ error: 'User profile not found' }, { status: 401 })
        }

        // Get org config separately to avoid complex include issues
        const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { organization_id: true },
        })
        if (!userRecord) {
            return Response.json({ error: 'User not found' }, { status: 401 })
        }

        const orgId = userRecord.organization_id
        const orgConfig = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { cross_group_query_enabled: true },
        })

        // Permission check
        if (!hasPermission(userGrp.role, 'ai:use_chat')) {
            return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Rate limit per org
        const rl = await checkRateLimit(aiRateLimiter, `ai:${orgId}`)
        if (!rl.allowed) {
            return Response.json(
                { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
                { status: 429 }
            )
        }

        let question: string
        let history: ChatMessage[]
        let sessionId: string | undefined
        let knowledgeBaseId: string | undefined
        let useVector: boolean | undefined
        let useGraph: boolean | undefined
        let useRerank: boolean | undefined

        try {
            const body = await req.json()
            question = body.question
            history = body.history ?? []
            sessionId = body.sessionId
            knowledgeBaseId = body.knowledgeBaseId
            useVector = body.useVector
            useGraph = body.useGraph
            useRerank = body.useRerank
        } catch {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
        }

        // Validation: At least Vector or Rerank must be active
        // Default to true if undefined (backward compatibility)
        const v = useVector ?? true
        const r = useRerank ?? false
        if (!v && !r) {
            return Response.json(
                { error: 'Gagal: Setidaknya Vektor atau Reranking harus aktif.' },
                { status: 400 }
            )
        }

        if (!question?.trim()) {
            return Response.json({ error: 'Question is required' }, { status: 400 })
        }

        // ── Greeting Detection ───────────────────────────────────────
        // If user input is just a greeting, respond directly without RAG
        const GREETING_PATTERN = /^(h[ae]llo|hai|hi|hey|yo|hola|selamat\s+(pagi|siang|sore|malam)|apa\s*kabar|assalamualaikum|salam)[\s!?.,]*$/i
        const isGreeting = GREETING_PATTERN.test(question.trim())

        const abortController = new AbortController()
        const signal = abortController.signal

        // ── ReadableStream for SSE ──────────────────────────────────
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()
                const send = (event: string, data: unknown) => {
                    controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    )
                }

                try {
                    let kbName = ''
                    if (knowledgeBaseId) {
                        const kb = await prisma.knowledgeBase.findUnique({
                            where: { id: knowledgeBaseId },
                            select: { name: true }
                        })
                        kbName = kb?.name || ''
                    }

                    if (isGreeting) {
                        // ── Greeting response without RAG/references ──────
                        const greetingResponses = kbName 
                            ? [
                                `Halo! 👋 Saya siap membantu Anda mengenai **${kbName}**. Apa yang ingin Anda tanyakan?`,
                                `Hai! 😊 Ada yang bisa saya bantu terkait informasi di dalam **${kbName}**?`,
                                `Halo! Saya AI asisten untuk **${kbName}**. Silakan ajukan pertanyaan Anda.`,
                            ]
                            : [
                                'Halo! 👋 Ada yang bisa saya bantu mengenai dokumen perusahaan?',
                                'Hai! 😊 Silakan tanyakan apapun tentang knowledge base Anda.',
                                'Halo! Saya siap membantu Anda mencari informasi dari dokumen. Silakan bertanya!',
                                'Hai! 👋 Saya AI Knowledge Assistant. Apa yang ingin Anda ketahui?',
                            ]
                        const rawReply = greetingResponses[Math.floor(Math.random() * greetingResponses.length)]
                        const greetReply = rawReply.replace(/\*\*/g, '')

                        // Send as streaming chunks (natural feel)
                        const words = greetReply.split(' ')
                        for (const word of words) {
                            send('chunk', { text: word + ' ' })
                            await new Promise(r => setTimeout(r, 30))
                        }

                        // No citations for greetings
                        send('done', { done: true })
                    } else {
                        // ── Fetch session summary if available ──
                        let sessionSummary: string | undefined
                        if (sessionId) {
                            const chatSession = await prisma.chatSession.findUnique({
                                where: { id: sessionId },
                                select: { summary: true }
                            })
                            sessionSummary = chatSession?.summary || undefined
                        }

                        // ── Normal RAG query ──────────────────────────────
                        // Call RAG pipeline, stream chunk by chunk
                        const citations = await ragQuery({
                            question,
                            history,
                            userId: userId,
                            orgId,
                            userRole: userGrp.role,
                            groupId: userGrp.group_id,
                            crossGroupEnabled:
                                orgConfig?.cross_group_query_enabled ?? false,
                            knowledgeBaseId,
                            sessionSummary, // Pass the summary here
                            useVector,      // Pass the new flags
                            useGraph,
                            useRerank,
                            onChunk: (text) => send('chunk', { text }),
                            signal,
                        })

                        // Send citations as final event
                        send('citations', { citations })
                        send('done', { done: true })

                        // ── Persist messages to DB & Compaction ───────────────────────────
                        if (sessionId) {
                            try {
                                const msgCount = await prisma.chatMessage.count({
                                    where: { session_id: sessionId },
                                })

                                // Auto-generate title if this is the first exchange
                                if (msgCount === 0) {
                                    try {
                                        const { getAIServiceForOrg } = await import('@/lib/ai/get-ai-service')
                                        const ai = await getAIServiceForOrg(orgId)
                                        const title = await ai.generateCompletion(
                                            `Buatkan judul singkat (maksimal 6 kata, tanpa tanda kutip) untuk percakapan yang dimulai dengan pertanyaan: "${question.slice(0, 200)}". JANGAN GUNAKAN FORMAT MARKDOWN ATAU BINTANG.`,
                                            { maxTokens: 30 }
                                        )
                                        await prisma.chatSession.update({
                                            where: { id: sessionId },
                                            data: { title: title.trim().replace(/^["']|["']$/g, '').slice(0, 80) },
                                        })
                                        send('title_updated', { title: title.trim() })
                                    } catch (titleErr) {
                                        logger.warn('Failed to generate chat title', titleErr)
                                    }
                                }

                                // ── TRIGGER COMPACTION ──
                                // Every 5 messages after the first 10, or if auto_summary is forced
                                const orgFull = await prisma.organization.findUnique({
                                    where: { id: orgId },
                                    select: { auto_summary_chat: true }
                                })

                                if (orgFull?.auto_summary_chat && msgCount >= 10 && msgCount % 5 === 0) {
                                    const { summarizeSession } = await import('@/lib/ai/chat-compaction')
                                    // Run in background
                                    summarizeSession(sessionId, orgId).catch(err => 
                                        logger.error('Background compaction failed', err)
                                    )
                                }

                            } catch (persistErr) {
                                logger.warn('Failed to persist chat session metadata', persistErr)
                            }
                        }

                        // Log AI usage
                        try {
                            await prisma.aIUsageLog.create({
                                data: {
                                    organization_id: orgId,
                                    user_id: userId,
                                    action_type: 'CHAT_QUERY',
                                    tokens_used: Math.ceil(question.length / 3.5) * 3,
                                    model_used: 'gemini-2.5-flash',
                                },
                            })
                        } catch (logErr) {
                            logger.warn('Failed to log AI usage', logErr)
                        }
                    } // end else (non-greeting)
                } catch (err) {
                    if (!signal.aborted) {
                        console.error('[CHAT API] RAG pipeline error:', err)
                        logger.error('RAG pipeline error', err)
                        const errMessage = err instanceof Error
                            ? err.message
                            : 'Gagal mendapat respons dari AI. Coba lagi.'
                        send('error', { message: errMessage })
                    }
                } finally {
                    controller.close()
                }
            },
            cancel() {
                abortController.abort() // Client disconnect → stop LLM
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        })
    } catch (outerErr) {
        console.error('[CHAT API] Uncaught error:', outerErr)
        return Response.json(
            { error: outerErr instanceof Error ? outerErr.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
