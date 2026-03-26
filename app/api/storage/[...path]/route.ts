import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import mime from 'mime'

export const dynamic = 'force-dynamic'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return new NextResponse(
            `<html><body style="margin:40px;font-family:sans-serif;color:#666">
                <h3>⚠️ Akses Ditolak</h3>
                <p>Anda harus login untuk melihat dokumen ini.</p>
            </body></html>`,
            {
                status: 401,
                headers: { 'Content-Type': 'text/html' },
            }
        )
    }

    const { path } = await params
    const filePath = path.join('/')

    if (!filePath) {
        return NextResponse.json({ error: 'Missing file path' }, { status: 400 })
    }

    try {
        const uploadDir = env.UPLOAD_DIR || './uploads'
        // Handle path joining safely (basic protection)
        const safeFilePath = filePath.replace(/\.\./g, '')
        const fullPath = join(process.cwd(), uploadDir, safeFilePath)

        if (!existsSync(fullPath)) {
            return new NextResponse(
                `<html><body style="margin:40px;font-family:sans-serif;color:#666">
                    <h3>⚠️ Gagal memuat file</h3>
                    <p>File tidak ditemukan: ${filePath}</p>
                </body></html>`,
                {
                    status: 404,
                    headers: { 'Content-Type': 'text/html' },
                }
            )
        }

        const buffer = await readFile(fullPath)
        const mimeType = mime.getType(fullPath) || 'application/octet-stream'

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': 'inline',
                'Cache-Control': 'private, max-age=3600',
                'Content-Length': buffer.byteLength.toString(),
            },
        })
    } catch (err: any) {
        console.error('[Storage Serve] Error:', err)
        return new NextResponse(
            `<html><body style="margin:40px;font-family:sans-serif;color:#666">
                <h3>⚠️ Error</h3>
                <p>Internal server error when serving file.</p>
            </body></html>`,
            {
                status: 500,
                headers: { 'Content-Type': 'text/html' },
            }
        )
    }
}
