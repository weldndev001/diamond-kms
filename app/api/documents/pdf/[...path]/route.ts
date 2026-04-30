import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
    _request: NextRequest,
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

        const IS_VERCEL = process.env.Vercel === '1' || !!process.env.VERCEL_URL
        const safeFilePath = filePath.replace(/\.\./g, '')
        const dbPath = `documents/${safeFilePath}`
        
        console.log(`[PDF Proxy] Fetching from Database: ${dbPath}`)

        const storageFile = await prisma.storageFile.findUnique({
            where: { path: dbPath }
        })

        if (!storageFile) {
            console.error('[PDF Proxy] File NOT found in Database:', dbPath)
            return new NextResponse(
                `<html><body style="margin:40px;font-family:sans-serif;color:#666;line-height:1.6">
                    <h3 style="color:#e11d48">⚠️ Gagal memuat Dokumen</h3>
                    <p><b>File tidak ditemukan di database.</b></p>
                    <div style="background:#f1f5f9;padding:15px;border-radius:8px;font-size:12px;margin-top:20px;font-family:monospace">
                        <b>Debug Info:</b><br/>
                        Env: ${IS_VERCEL ? 'Vercel' : 'Local/Dev'}<br/>
                        DB Path: ${dbPath}
                    </div>
                </body></html>`,
                {
                    status: 404,
                    headers: { 'Content-Type': 'text/html' },
                }
            )
        }

        const buffer = storageFile.content
        
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
