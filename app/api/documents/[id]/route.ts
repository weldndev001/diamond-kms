import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { env } from '@/lib/env'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const document = await prisma.document.findUnique({
        where: { id },
        include: { group: true }
    })

    if (!document) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: document })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { protection_config } = body

    const document = await prisma.document.update({
        where: { id },
        data: { protection_config }
    })

    return NextResponse.json({ success: true, data: document })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const document = await prisma.document.findUnique({ where: { id } })
    if (!document) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    // Physically delete from database storage
    try {
        const safeFilePath = document.file_path.replace(/\.\./g, '')
        const dbPath = `documents/${safeFilePath}`
        
        await prisma.storageFile.delete({
            where: { path: dbPath }
        }).catch(() => null) // Ignore if already deleted
    } catch (err) {
        console.error('Failed to delete file from database storage:', err)
    }

    await prisma.document.delete({ where: { id } })

    return NextResponse.json({ success: true })
}
