// lib/ai/audio-extractor.ts
import { getAIServiceForOrg } from './get-ai-service'
import { logger } from '@/lib/logging/redact'

export interface ExtractedAudio {
    fullText: string
    pages: { pageNum: number; text: string }[]
    pageCount: number
}

/**
 * Extracts/transcribes text from an audio file buffer.
 * It uses the organization's configured AI service to perform Speech-To-Text.
 */
export async function extractAudioText(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    orgId: string
): Promise<ExtractedAudio> {
    try {
        const aiService = await getAIServiceForOrg(orgId)

        if (!aiService.transcribeAudio) {
            throw new Error(`AI Provider ${aiService.providerName} does not support audio transcription.`)
        }

        const transcription = await aiService.transcribeAudio(fileBuffer, fileName, mimeType)

        if (!transcription || transcription.trim().length === 0) {
            throw new Error('Audio transcription resulted in empty text.')
        }

        // Return the transcription as a single page
        return {
            fullText: transcription,
            pages: [{ pageNum: 1, text: transcription }],
            pageCount: 1,
        }
    } catch (err: any) {
        logger.error(`Audio extraction failed for ${fileName}:`, err?.message || err)
        throw new Error(`Audio extraction failed: ${err?.message || 'Unknown error'}`)
    }
}
