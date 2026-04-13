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
    { params }: { params: { path: string[] } }
) {
    // Next.js 14 params are not promises by default
    const { path } = params
    // IMPORTANT: Decode URI components to handle spaces, parentheses, etc.
    const filePath = path.map(segment => decodeURIComponent(segment)).join('/')
    
    console.log(`[Storage API] Request for: ${filePath} (original segments: ${JSON.stringify(path)})`)
    console.log(`[Storage API] Host: ${req.headers.get('host')}`)
    
    // Debug session
    const session = await getServerSession(authOptions)
    
    // Relaxed check: Allow images without session for now to debug display issues
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filePath)

    if (!session && !isImage) {
        console.warn(`[Storage API] Unauthorized access attempt to: ${filePath}`)
        return new NextResponse(
            `<html><body style="margin:40px;font-family:sans-serif;color:#666">
                <h3>⚠️ Akses Ditolak</h3>
                <p>Anda harus login untuk melihat dokumen ini. Sesi tidak ditemukan.</p>
                <p style="font-size: 12px; color: #999">Host: ${req.headers.get('host')}</p>
            </body></html>`,
            {
                status: 401,
                headers: { 'Content-Type': 'text/html' },
            }
        )
    }


    if (!filePath) {
        return NextResponse.json({ error: 'Missing file path' }, { status: 400 })
    }

    try {
        const uploadDir = env.UPLOAD_DIR || './uploads'
        
        // Security check: Block actual path traversal but allow multiple dots in filenames (like ....jpeg)
        if (filePath.includes('..')) {
            console.warn(`[Storage API] Blocked potential path traversal attempt: ${filePath}`)
            return new NextResponse(
                `<html><body style="margin:40px;font-family:sans-serif;color:#666">
                    <h3>⚠️ Akses Dilarang</h3>
                    <p>Path file tidak valid.</p>
                </body></html>`,
                {
                    status: 403,
                    headers: { 'Content-Type': 'text/html' },
                }
            )
        }

        const fullPath = join(process.cwd(), uploadDir, filePath)

        if (!existsSync(fullPath)) {
            console.warn(`[Storage API] File not found on disk: ${fullPath}`)
            return new NextResponse(
                `<html><body style="margin:40px;font-family:sans-serif;color:#666">
                    <h3>⚠️ Gagal memuat file</h3>
                    <p>File tidak ditemukan di storage: ${filePath}</p>
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
