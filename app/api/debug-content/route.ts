import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'no id' })
    const content = await prisma.content.findUnique({ where: { id } })
    return NextResponse.json({ 
        id: content?.id, 
        bodyLength: content?.body?.length, 
        substring: content?.body?.substring(0, 1000) 
    })
}
