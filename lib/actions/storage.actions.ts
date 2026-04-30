'use server'

import prisma from '@/lib/prisma'

/**
 * Uploads a file to the database storage.
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
        
        // Ensure path uses forward slashes and doesn't escape
        const safePath = path.replace(/\\/g, '/').replace(/\.\./g, '')
        const storagePath = `${bucket}/${safePath}`

        console.log(`[Storage] Saving to Database: ${storagePath}`)

        await prisma.storageFile.upsert({
            where: { path: storagePath },
            update: {
                content: buffer,
                mime_type: file.type || 'application/octet-stream',
                created_at: new Date()
            },
            create: {
                path: storagePath,
                content: buffer,
                mime_type: file.type || 'application/octet-stream'
            }
        })

        console.log(`[Storage] Successfully saved to Database`)

        // ALWAYS use relative URL — works on any domain
        const publicUrl = `/api/storage/${bucket}/${path}`
        console.log(`[Storage] Generated public URL: ${publicUrl}`)

        return { success: true, publicUrl }
    } catch (error: any) {
        console.error('Server upload action error:', error)
        return { success: false, error: error.message }
    }
}
