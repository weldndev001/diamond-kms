import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const sessionAuth = await getServerSession(authOptions)
    if (!sessionAuth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (sessionAuth.user as any).id
    const { id } = await params

    const session = await prisma.chatSession.findFirst({
        where: { id, user_id: userId },
        include: {
            messages: { orderBy: { created_at: 'asc' } },
        },
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.messages.length === 0) {
        return NextResponse.json({ error: 'No messages to summarize' }, { status: 400 })
    }

    const ai = await getAIServiceForOrg(session.organization_id)

    const transcript = session.messages
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')

    const summary = await ai.generateCompletion(
        `Ringkas percakapan ini dalam 2-3 kalimat ringkas dalam bahasa Indonesia:\n\n${transcript.slice(0, 8000)}`,
        { maxTokens: 300 }
    )

    await prisma.chatSession.update({
        where: { id },
        data: { summary: summary.trim() },
    })

    return NextResponse.json({ summary: summary.trim() })
}
