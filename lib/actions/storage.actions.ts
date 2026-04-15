'use server'

import { env } from '@/lib/env'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * Uploads a file to the local filesystem.
 * This is a self-hosted replacement for external storage.
 * 
 * IMPORTANT: Returns a RELATIVE publicUrl (e.g. /api/storage/faqs/image.png)
 * so it works on any domain (localhost, vercel, custom domain).
 */
export async function uploadFileAction(formData: FormData) {
    try {
        const file = formData.get('file') as File
        const bucket = formData.get('bucket') as string || 'documents'
        const path = formData.get('path') as string

        console.log(`[Storage] Uploading to bucket: ${bucket}, path: ${path}`)

        if (!file || !path) {
            console.error('[Storage] Missing file or path')
            return { success: false, error: 'File and path are required' }
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Ensure upload directory exists
        const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL_URL
        const uploadDir = IS_VERCEL ? '/tmp/uploads' : (env.UPLOAD_DIR || './uploads')
        
        // Ensure path uses forward slashes and doesn't escape
        const safePath = path.replace(/\\/g, '/').replace(/\.\./g, '')
        const fullPath = join(uploadDir, bucket, safePath)
        const dirPath = join(fullPath, '..')

        console.log(`[Storage] Environment: ${IS_VERCEL ? 'Vercel' : 'Local'}`)
        console.log(`[Storage] Target full path: ${fullPath}`)

        if (!existsSync(dirPath)) {
            console.log(`[Storage] Creating directory: ${dirPath}`)
            await mkdir(dirPath, { recursive: true })
        }

        await writeFile(fullPath, buffer)
        console.log(`[Storage] Successfully wrote file to disk`)

        // ALWAYS use relative URL — works on any domain
        const publicUrl = `/api/storage/${bucket}/${path}`
        console.log(`[Storage] Generated public URL: ${publicUrl}`)

        return { success: true, publicUrl }
    } catch (error: any) {
        console.error('Server upload action error:', error)
        return { success: false, error: error.message }
    }
}
