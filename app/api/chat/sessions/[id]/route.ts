import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
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
            messages: {
                orderBy: { created_at: 'asc' },
            },
        },
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    return NextResponse.json({ session })
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const sessionAuth = await getServerSession(authOptions)
    if (!sessionAuth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (sessionAuth.user as any).id
    const { id } = await params

    // Ensure ownership
    const session = await prisma.chatSession.findFirst({
        where: { id, user_id: userId },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.chatSession.delete({ where: { id } })

    return NextResponse.json({ success: true })
}
