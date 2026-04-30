import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
        const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL_URL
        const uploadDir = IS_VERCEL ? '/tmp/uploads' : (env.UPLOAD_DIR || './uploads')
        const safeFilePath = filePath.replace(/\.\./g, '')
        const isDev = process.env.NODE_ENV === 'development'
        
        // On Vercel, /tmp is absolute, so we don't join with process.cwd()
        const fullPath = IS_VERCEL 
            ? join(uploadDir, 'documents', safeFilePath)
            : join(process.cwd(), uploadDir, 'documents', safeFilePath)
        
        // Log the path being checked for debugging
        console.log(`[PDF Proxy] Environment: ${IS_VERCEL ? 'Vercel' : 'Local'}`)
        console.log(`[PDF Proxy] Checking path: ${fullPath}`)

        if (!existsSync(fullPath)) {
            console.error('[PDF Proxy] File NOT found at:', fullPath)
            
            // Check if directory exists at least
            const dirPath = join(fullPath, '..')
            const dirExists = existsSync(dirPath)
            console.log(`[PDF Proxy] Parent directory exists: ${dirExists} (${dirPath})`)

            return new NextResponse(
                `<html><body style="margin:40px;font-family:sans-serif;color:#666;line-height:1.6">
                    <h3 style="color:#e11d48">⚠️ Gagal memuat PDF</h3>
                    <p><b>File tidak ditemukan di server.</b></p>
                    <div style="background:#f1f5f9;padding:15px;border-radius:8px;font-size:12px;margin-top:20px;font-family:monospace">
                        <b>Debug Info:</b><br/>
                        Env: ${IS_VERCEL ? 'Vercel' : 'Local/Dev'}<br/>
                        Path: ${safeFilePath}<br/>
                        ${(isDev || IS_VERCEL) ? `Full Path: ${fullPath}<br/>` : ''}
                        Directory: ${dirExists ? 'Exists' : 'MISSING'}
                    </div>
                    <p style="font-size:13px;margin-top:20px">Pastikan file sudah terunggah ke folder <code>${IS_VERCEL ? '/tmp/uploads' : 'uploads'}/documents/</code> di server Anda.</p>
                </body></html>`,
                {
                    status: 404,
                    headers: { 'Content-Type': 'text/html' },
                }
            )
        }

        const buffer = await readFile(fullPath)
        
        let mimeType = 'application/pdf'
        try {
            const mime = require('mime-types')
            const lookup = mime.lookup(safeFilePath)
            if (lookup) {
                mimeType = lookup
            }
        } catch (e) {
            // fallback
        }

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': 'inline',
                'Cache-Control': 'private, max-age=3600',
                'Content-Length': buffer.byteLength.toString(),
            },
        })
    } catch (err: any) {
        console.error('[PDF Proxy] Error:', err)
        return new NextResponse(
            `<html><body style="margin:40px;font-family:sans-serif;color:#666">
                <h3>⚠️ Error</h3>
                <p>${err.message || 'Gagal memuat PDF'}</p>
            </body></html>`,
            {
                status: 500,
                headers: { 'Content-Type': 'text/html' },
            }
        )
    }
}
