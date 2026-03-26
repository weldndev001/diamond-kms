'use server'

import { env } from '@/lib/env'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * Uploads a file to the local filesystem.
 * This is a self-hosted replacement for external storage.
 */
export async function uploadFileAction(formData: FormData) {
    try {
        const file = formData.get('file') as File
        const bucket = formData.get('bucket') as string || 'documents'
        const path = formData.get('path') as string

        if (!file || !path) {
            return { success: false, error: 'File and path are required' }
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Ensure upload directory exists
        const uploadDir = env.UPLOAD_DIR || './uploads'
        const fullPath = join(process.cwd(), uploadDir, bucket, path)
        const dirPath = join(fullPath, '..')

        if (!existsSync(dirPath)) {
            await mkdir(dirPath, { recursive: true })
        }

        await writeFile(fullPath, buffer)

        // Get public URL using our local storage API
        const publicUrl = `${env.NEXT_PUBLIC_APP_URL}/api/storage/${bucket}/${path}`

        return { success: true, publicUrl }
    } catch (error: any) {
        console.error('Server upload action error:', error)
        return { success: false, error: error.message }
    }
}
