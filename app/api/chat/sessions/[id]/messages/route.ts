import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const sessionAuth = await getServerSession(authOptions)
    if (!sessionAuth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (sessionAuth.user as any).id
    const { id: sessionId } = await params

    // Verify ownership
    const sessionDoc = await prisma.chatSession.findFirst({
        where: { id: sessionId, user_id: userId },
    })
    if (!sessionDoc) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const body = await req.json()
    const { userMessage, assistantMessage, citations } = body

    if (!userMessage || !assistantMessage) {
        return NextResponse.json({ error: 'Both messages required' }, { status: 400 })
    }

    // Save both messages in a transaction
    await prisma.$transaction([
        prisma.chatMessage.create({
            data: {
                session_id: sessionId,
                role: 'user',
                content: userMessage,
            },
        }),
        prisma.chatMessage.create({
            data: {
                session_id: sessionId,
                role: 'assistant',
                content: assistantMessage,
                citations: citations || null,
            },
        }),
        prisma.chatSession.update({
            where: { id: sessionId },
            data: { updated_at: new Date() },
        }),
    ])

    // Check if auto-summary is enabled (stored in ai_provider_config JSON)
    const org = await prisma.organization.findUnique({
        where: { id: sessionDoc.organization_id },
        select: { ai_provider_config: true },
    })
    const aiConfig = org?.ai_provider_config as any

    if (aiConfig?.autoSummaryChat) {
        // Auto-generate summary in background (don't block response)
        generateSummaryBackground(sessionId, sessionDoc.organization_id).catch(() => { })
    }

    return NextResponse.json({ success: true })
}

async function generateSummaryBackground(sessionId: string, orgId: string) {
    const messages = await prisma.chatMessage.findMany({
        where: { session_id: sessionId },
        orderBy: { created_at: 'asc' },
    })

    if (messages.length < 2) return

    const { getAIServiceForOrg } = await import('@/lib/ai/get-ai-service')
    const ai = await getAIServiceForOrg(orgId)

    const transcript = messages
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')

    const summary = await ai.generateCompletion(
        `Ringkas percakapan ini dalam 2-3 kalimat ringkas dalam bahasa Indonesia:\n\n${transcript.slice(0, 8000)}`,
        { maxTokens: 300 }
    )

    await prisma.chatSession.update({
        where: { id: sessionId },
        data: { summary: summary.trim() },
    })
}
