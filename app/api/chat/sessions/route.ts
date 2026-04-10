import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id

    const sessions = await prisma.chatSession.findMany({
        where: { user_id: userId },
        orderBy: { updated_at: 'desc' },
        select: {
            id: true,
            title: true,
            summary: true,
            created_at: true,
            updated_at: true,
            _count: { select: { messages: true } },
        },
    })

    return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
    const sessionAuth = await getServerSession(authOptions)
    if (!sessionAuth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (sessionAuth.user as any).id

    const profile = await prisma.userGroup.findFirst({
        where: { user_id: userId, is_primary: true },
        include: { user: true },
    })
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 401 })

    const session = await prisma.chatSession.create({
        data: {
            user_id: userId,
            organization_id: profile.user.organization_id,
            title: 'New Chat',
        },
    })

    return NextResponse.json({ session })
}
