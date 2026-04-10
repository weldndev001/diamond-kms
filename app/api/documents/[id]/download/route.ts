import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { env } from '@/lib/env'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import mime from 'mime'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const document = await prisma.document.findUnique({
        where: { id },
        include: { organization: true, group: true }
    })
    if (!document) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const config: any = document.protection_config || {}

    // If download is disabled, block this API completely
    if (config.no_download) {
        return NextResponse.json({ success: false, error: 'Document download is disabled due to Vault config' }, { status: 403 })
    }

    try {
        const uploadDir = env.UPLOAD_DIR || './uploads'
        const safeFilePath = document.file_path.replace(/\.\./g, '')
        const fullPath = join(process.cwd(), uploadDir, 'documents', safeFilePath)

        if (!existsSync(fullPath)) {
            return NextResponse.json({ success: false, error: 'File not found on server' }, { status: 404 })
        }

        const buffer = await readFile(fullPath)
        const mimeType = mime.getType(fullPath) || 'application/octet-stream'

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': `attachment; filename="${document.file_name}"`,
                'Content-Length': buffer.byteLength.toString(),
            },
        })
    } catch (error: any) {
        console.error('Download URL generation error:', error)
        return NextResponse.json({ success: false, error: error.message || 'Failed to trigger download' }, { status: 500 })
    }
}
