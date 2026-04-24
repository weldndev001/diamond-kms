// lib/ai/video-extractor.ts
// Extract audio + key frames from video files using ffmpeg
// Then leverage Gemma 4's native multimodal capabilities for analysis

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { logger } from '@/lib/logging/redact'

// @ts-ignore
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
// @ts-ignore
import ffprobeInstaller from '@ffprobe-installer/ffprobe'

const FFMPEG_PATH = ffmpegInstaller.path
const FFPROBE_PATH = ffprobeInstaller.path

const execFileAsync = promisify(execFile)

export interface ExtractedVideo {
    fullText: string
    pages: { pageNum: number; text: string }[]
    pageCount: number
    frames: ExtractedVideoFrame[]
    durationSeconds: number
}

export interface ExtractedVideoFrame {
    timestamp: number         // seconds
    base64: string            // data:image/jpeg;base64,...
    label: string
}

/**
 * Check if ffmpeg is available on the system
 */
async function checkFfmpegAvailable(): Promise<boolean> {
    try {
        await execFileAsync(FFMPEG_PATH, ['-version'])
        return true
    } catch {
        return false
    }
}

/**
 * Get video duration in seconds using ffprobe
 */
async function getVideoDuration(videoPath: string): Promise<number> {
    try {
        const { stdout } = await execFileAsync(FFPROBE_PATH, [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ])
        return parseFloat(stdout.trim()) || 0
    } catch (err) {
        console.error(`[VIDEO-EXTRACTOR] ffprobe error:`, err)
        return 0
    }
}

/**
 * Extract audio track from video and save as WAV file
 */
async function extractAudioFromVideo(
    videoPath: string,
    outputPath: string
): Promise<boolean> {
    try {
        await execFileAsync(FFMPEG_PATH, [
            '-i', videoPath,
            '-vn',                    // No video
            '-acodec', 'pcm_s16le',   // WAV format
            '-ar', '16000',           // 16kHz sample rate (optimal for STT)
            '-ac', '1',               // Mono
            '-y',                     // Overwrite
            outputPath
        ], { timeout: 120000 }) // 2 min timeout

        return existsSync(outputPath)
    } catch (err) {
        console.error(`[VIDEO-EXTRACTOR] Audio extraction error:`, err)
        return false
    }
}

/**
 * Extract key frames from video at regular intervals.
 * Takes snapshots every N seconds based on video duration.
 * 
 * @param videoPath - Path to the video file
 * @param outputDir - Directory to save frame images
 * @param maxFrames - Maximum number of frames to extract (default 8)
 * @param durationSeconds - Video duration in seconds
 * @returns Array of extracted frame file paths
 */
async function extractKeyFrames(
    videoPath: string,
    outputDir: string,
    maxFrames: number = 8,
    durationSeconds: number
): Promise<string[]> {
    if (durationSeconds <= 0) return []

    // Calculate interval between frames
    const interval = Math.max(1, Math.floor(durationSeconds / maxFrames))
    const framePaths: string[] = []

    // Use ffmpeg to extract frames at regular intervals
    try {
        const outputPattern = join(outputDir, 'frame_%04d.jpg')
        await execFileAsync(FFMPEG_PATH, [
            '-i', videoPath,
            '-vf', `fps=1/${interval},scale=640:-1`,  // 1 frame every N seconds, resize to 640px wide
            '-q:v', '3',             // JPEG quality (2-5, lower is better)
            '-frames:v', maxFrames.toString(),
            '-y',
            outputPattern
        ], { timeout: 120000 })

        // Collect generated frame paths
        for (let i = 1; i <= maxFrames; i++) {
            const framePath = join(outputDir, `frame_${String(i).padStart(4, '0')}.jpg`)
            if (existsSync(framePath)) {
                framePaths.push(framePath)
            }
        }
    } catch (err) {
        console.error(`[VIDEO-EXTRACTOR] Frame extraction error:`, err)
    }

    return framePaths
}

/**
 * Convert frame files to base64 encoded strings
 */
async function framesToBase64(framePaths: string[], durationSeconds: number, maxFrames: number): Promise<ExtractedVideoFrame[]> {
    const frames: ExtractedVideoFrame[] = []
    const interval = Math.max(1, Math.floor(durationSeconds / maxFrames))

    for (let i = 0; i < framePaths.length; i++) {
        try {
            const buffer = await readFile(framePaths[i])
            const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`
            const timestamp = i * interval
            const minutes = Math.floor(timestamp / 60)
            const seconds = timestamp % 60

            frames.push({
                timestamp,
                base64,
                label: `Frame pada ${minutes}:${String(seconds).padStart(2, '0')}`,
            })
        } catch (err) {
            console.error(`[VIDEO-EXTRACTOR] Failed to read frame ${framePaths[i]}:`, err)
        }
    }

    return frames
}

/**
 * Clean up temporary files
 */
async function cleanupTempFiles(paths: string[]): Promise<void> {
    for (const p of paths) {
        try {
            if (existsSync(p)) await unlink(p)
        } catch { /* ignore cleanup errors */ }
    }
}

/**
 * Main function: Extract text (via audio transcription) and key frames from a video file.
 * 
 * Pipeline:
 * 1. Save video buffer to temp file
 * 2. Get video duration via ffprobe
 * 3. Extract audio → transcribe with AI (Gemma 4 STT)
 * 4. Extract key frames → convert to base64
 * 5. Analyze key frames with AI Vision (Gemma 4 multimodal)
 * 6. Combine transcription + frame descriptions into searchable text
 * 
 * @param fileBuffer - Raw video file buffer
 * @param fileName - Original file name
 * @param mimeType - MIME type of the video
 * @param orgId - Organization ID for AI service
 * @param onProgress - Optional callback for progress updates
 */
export async function extractVideoContent(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    orgId: string,
    onProgress?: (message: string, progress: number) => Promise<void>
): Promise<ExtractedVideo> {
    const log = (msg: string) => console.log(`[VIDEO-EXTRACTOR] ${msg}`)

    // Check ffmpeg availability
    const hasFfmpeg = await checkFfmpegAvailable()
    if (!hasFfmpeg) {
        throw new Error(
            'ffmpeg tidak ditemukan di sistem. Install ffmpeg terlebih dahulu untuk memproses file video. ' +
            'Download: https://ffmpeg.org/download.html'
        )
    }

    // Create temp directory for processing
    const tmpDir = join(process.cwd(), 'uploads', '.tmp-video', Date.now().toString())
    if (!existsSync(tmpDir)) {
        await mkdir(tmpDir, { recursive: true })
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4'
    const tmpVideoPath = join(tmpDir, `input.${ext}`)
    const tmpAudioPath = join(tmpDir, 'audio.wav')
    const filesToCleanup: string[] = [tmpVideoPath, tmpAudioPath]

    try {
        // Step 1: Write video buffer to temp file
        log(`Writing ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB video to temp...`)
        await writeFile(tmpVideoPath, fileBuffer)

        // Step 2: Get video duration
        const durationSeconds = await getVideoDuration(tmpVideoPath)
        log(`Video duration: ${durationSeconds.toFixed(1)}s`)

        if (onProgress) {
            await onProgress(`Durasi video: ${Math.round(durationSeconds)} detik. Mengekstrak audio...`, 15)
        }

        // Step 3: Extract and transcribe audio
        let transcription = ''
        const hasAudio = await extractAudioFromVideo(tmpVideoPath, tmpAudioPath)
        
        if (hasAudio) {
            log('Audio extracted successfully, transcribing...')
            if (onProgress) {
                await onProgress('Mentranskripsi audio dari video menggunakan AI...', 20)
            }

            try {
                const { getAIServiceForOrg } = await import('./get-ai-service')
                const ai = await getAIServiceForOrg(orgId)

                if (ai.transcribeAudio) {
                    const audioBuffer = await readFile(tmpAudioPath)
                    transcription = await ai.transcribeAudio(audioBuffer, `${fileName}.wav`, 'audio/wav')
                    log(`Transcription completed: ${transcription.length} chars`)
                } else {
                    log('AI provider does not support audio transcription, skipping...')
                }
            } catch (err: any) {
                log(`Audio transcription failed (non-fatal): ${err.message}`)
                logger.warn('Video audio transcription failed', err)
            }
        } else {
            log('No audio track found or extraction failed')
        }

        // Step 4: Extract key frames
        if (onProgress) {
            await onProgress('Mengekstrak frame kunci dari video...', 35)
        }

        const maxFrames = Math.min(8, Math.max(3, Math.ceil(durationSeconds / 15))) // 1 frame per ~15 seconds, min 3, max 8
        const framePaths = await extractKeyFrames(tmpVideoPath, tmpDir, maxFrames, durationSeconds)
        log(`Extracted ${framePaths.length} key frames`)

        // Add frame paths to cleanup list
        filesToCleanup.push(...framePaths)

        // Step 5: Convert frames to base64
        const frames = await framesToBase64(framePaths, durationSeconds, maxFrames)

        // Step 6: Analyze key frames with Vision AI
        if (onProgress) {
            await onProgress(`Menganalisis ${frames.length} frame video dengan AI Vision...`, 40)
        }

        let frameDescriptions = ''
        if (frames.length > 0) {
            try {
                const { getAIServiceForOrg } = await import('./get-ai-service')
                const ai = await getAIServiceForOrg(orgId)

                if (ai.describeImage) {
                    const pLimit = (await import('p-limit')).default
                    const limit = pLimit(2) // Max 2 concurrent vision requests

                    const descriptions: string[] = []
                    let processed = 0

                    await Promise.all(
                        frames.map((frame, i) =>
                            limit(async () => {
                                try {
                                    const description = await ai.describeImage!(
                                        frame.base64,
                                        `Video "${fileName}" - ${frame.label}`
                                    )
                                    if (description && description.trim().length > 10) {
                                        descriptions[i] = `[${frame.label}]: ${description.trim()}`
                                        log(`✅ Frame ${i + 1} analyzed`)
                                    }
                                } catch (err) {
                                    log(`⚠️ Frame ${i + 1} analysis failed (non-fatal)`)
                                }
                                processed++
                                if (onProgress && processed % 2 === 0) {
                                    const frameProgress = 40 + Math.floor((processed / frames.length) * 10)
                                    await onProgress(`Menganalisis frame ${processed}/${frames.length}...`, frameProgress)
                                }
                            })
                        )
                    )

                    frameDescriptions = descriptions.filter(Boolean).join('\n\n')
                    log(`Generated ${descriptions.filter(Boolean).length} frame descriptions`)
                } else {
                    log('AI provider does not support image analysis, skipping frame analysis...')
                }
            } catch (err: any) {
                log(`Frame analysis failed (non-fatal): ${err.message}`)
            }
        }

        // Step 7: Combine all extracted content
        const durationStr = `${Math.floor(durationSeconds / 60)}:${String(Math.round(durationSeconds % 60)).padStart(2, '0')}`
        const sections: string[] = []

        sections.push(`=== INFORMASI VIDEO ===`)
        sections.push(`File: ${fileName}`)
        sections.push(`Durasi: ${durationStr}`)
        sections.push(`Tipe: ${mimeType}`)
        sections.push(`Ukuran: ${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB`)
        sections.push(`Jumlah Frame yang Dianalisis: ${frames.length}`)

        if (transcription) {
            sections.push(`\n=== TRANSKRIPSI AUDIO ===`)
            sections.push(transcription)
        }

        if (frameDescriptions) {
            sections.push(`\n=== ANALISIS VISUAL (Frame-by-Frame) ===`)
            sections.push(frameDescriptions)
        }

        const fullText = sections.join('\n')

        // Build pages for chunking
        const pages: { pageNum: number; text: string }[] = []
        let pageNum = 1

        // Page 1: Video metadata
        pages.push({ pageNum: pageNum++, text: sections.slice(0, 6).join('\n') })

        // Pages 2+: Transcription (split into ~2000 char segments)
        if (transcription) {
            const transChunks = splitTextIntoSegments(transcription, 2000)
            for (const chunk of transChunks) {
                pages.push({ pageNum: pageNum++, text: `[Transkripsi Audio]\n${chunk}` })
            }
        }

        // Pages N+: Frame descriptions
        if (frameDescriptions) {
            const frameChunks = splitTextIntoSegments(frameDescriptions, 2000)
            for (const chunk of frameChunks) {
                pages.push({ pageNum: pageNum++, text: `[Analisis Visual]\n${chunk}` })
            }
        }

        return {
            fullText,
            pages,
            pageCount: pages.length,
            frames,
            durationSeconds,
        }
    } finally {
        // Cleanup temp files
        await cleanupTempFiles(filesToCleanup)
        // Try to remove temp directory
        try {
            const { rmdir } = await import('fs/promises')
            await rmdir(tmpDir)
        } catch { /* ignore - directory might not be empty */ }
    }
}

/**
 * Split text into segments of approximately maxChars characters,
 * breaking at sentence boundaries when possible.
 */
function splitTextIntoSegments(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) return [text]

    const segments: string[] = []
    let remaining = text

    while (remaining.length > 0) {
        if (remaining.length <= maxChars) {
            segments.push(remaining)
            break
        }

        // Find a good break point (sentence end) near maxChars
        let breakAt = maxChars
        const sentenceEnd = remaining.lastIndexOf('. ', maxChars)
        if (sentenceEnd > maxChars * 0.5) {
            breakAt = sentenceEnd + 1
        } else {
            const newline = remaining.lastIndexOf('\n', maxChars)
            if (newline > maxChars * 0.5) {
                breakAt = newline
            }
        }

        segments.push(remaining.slice(0, breakAt).trim())
        remaining = remaining.slice(breakAt).trim()
    }

    return segments
}
