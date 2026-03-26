import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET: Fetch chat history for a specific document or content
export async function GET(req: NextRequest) {
    const sessionAuth = await getServerSession(authOptions)
    if (!sessionAuth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (sessionAuth.user as any).id
    const { searchParams } = new URL(req.url)
    const documentId = searchParams.get('documentId')
    const contentId = searchParams.get('contentId')

    if (!documentId && !contentId) {
        return NextResponse.json({ error: 'documentId or contentId required' }, { status: 400 })
    }

    try {
        const session = await prisma.chatSession.findFirst({
            where: {
                user_id: userId,
                ...(documentId ? { document_id: documentId } : {}),
                ...(contentId ? { content_id: contentId } : {}),
            },
            include: {
                messages: {
                    orderBy: { created_at: 'asc' }
                }
            }
        })

        if (!session) return NextResponse.json({ messages: [] })

        const formattedMessages = session.messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }))

        return NextResponse.json({
            sessionId: session.id,
            messages: formattedMessages
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST: Save or update chat history
export async function POST(req: NextRequest) {
    const sessionAuth = await getServerSession(authOptions)
    if (!sessionAuth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (sessionAuth.user as any).id

    try {
        const body = await req.json()
        const { documentId, contentId, title, messages } = body

        if (!documentId && !contentId) {
            return NextResponse.json({ error: 'documentId or contentId required' }, { status: 400 })
        }
        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'messages array required' }, { status: 400 })
        }

        const profile = await prisma.userDivision.findFirst({
            where: { user_id: userId, is_primary: true },
            include: { user: true },
        })

        const organizationId = profile?.user?.organization_id

        if (!organizationId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
        }

        // Find existing session or create true
        let session = await prisma.chatSession.findFirst({
            where: {
                user_id: userId,
                ...(documentId ? { document_id: documentId } : {}),
                ...(contentId ? { content_id: contentId } : {}),
            }
        })

        if (!session) {
            session = await prisma.chatSession.create({
                data: {
                    user_id: userId,
                    organization_id: organizationId,
                    title: title || 'Document Q&A',
                    document_id: documentId,
                    content_id: contentId,
                }
            })
        }

        // We delete all existing messages to replace with the incoming stream
        await prisma.chatMessage.deleteMany({
            where: { session_id: session.id }
        })

        if (messages.length > 0) {
            await prisma.chatMessage.createMany({
                data: messages.map(msg => ({
                    session_id: session!.id,
                    role: msg.role,
                    content: msg.content
                }))
            })
        }

        return NextResponse.json({ success: true, sessionId: session.id })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// DELETE: Clear chat history
export async function DELETE(req: NextRequest) {
    const sessionAuth = await getServerSession(authOptions)
    if (!sessionAuth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (sessionAuth.user as any).id
    const { searchParams } = new URL(req.url)
    const documentId = searchParams.get('documentId')
    const contentId = searchParams.get('contentId')

    if (!documentId && !contentId) {
        return NextResponse.json({ error: 'documentId or contentId required' }, { status: 400 })
    }

    try {
        await prisma.chatSession.deleteMany({
            where: {
                user_id: userId,
                ...(documentId ? { document_id: documentId } : {}),
                ...(contentId ? { content_id: contentId } : {}),
            }
        })
        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
