import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const count = await prisma.userGroup.count({ where: { group_id: params.id } })
    if (count > 0) return NextResponse.json({ success: false, error: 'Has active users' }, { status: 400 })

    await prisma.group.delete({
        where: { id: params.id }
    })
    return NextResponse.json({ success: true })
}
