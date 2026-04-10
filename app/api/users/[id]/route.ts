import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const user = await prisma.user.findUnique({
        where: { id: params.id },
        include: { user_groups: true }
    })
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: user })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    await prisma.user.update({
        where: { id: params.id },
        data: { is_active: false }
    })
    return NextResponse.json({ success: true })
}
