// lib/ai/providers/gemini.ts
// Google Gemini 2.5 Flash — provider utama DIAMOND KMS
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIService, DocumentMetadata } from '../types'
import { logger } from '@/lib/logging/redact'
import { withRetry } from '../utils'
import { env } from '@/lib/env'

export class GeminiService implements AIService {
    readonly providerName = 'google-gemini'
    readonly embeddingModel = 'embedding-001'

    private genAI: GoogleGenerativeAI
    private chatModel: string

    constructor(apiKey: string, chatModel: string = 'gemini-2.5-flash') {
        console.log(`\n🚨 [GEMINI-FACTORY] Creating GeminiService instance! Model: ${chatModel}`)
        this.genAI = new GoogleGenerativeAI(apiKey)
        this.chatModel = chatModel
    }

    // ─── Embedding ──────────────────────────────────────────────
    async generateEmbedding(text: string): Promise<number[]> {
        return withRetry(async () => {
            const model = this.genAI.getGenerativeModel({ model: this.embeddingModel })
            const result = await model.embedContent(text)
            return result.embedding.values // 768-dimensional float array
        })
    }

    // ─── Completion ─────────────────────────────────────────────
    async generateCompletion(
        prompt: string,
        options?: { systemPrompt?: string; maxTokens?: number; jsonMode?: boolean }
    ): Promise<string> {
        return withRetry(async () => {
            const model = this.genAI.getGenerativeModel({
                model: this.chatModel,
                generationConfig: {
                    maxOutputTokens: options?.maxTokens ?? parseInt(env.AI_MAX_TOKENS || '2048', 10),
                    responseMimeType: options?.jsonMode ? 'application/json' : 'text/plain',
                    temperature: parseFloat(env.AI_TEMPERATURE || '0.7'),
                    topP: parseFloat(env.AI_TOP_P || '0.9'),
                    topK: parseInt(env.AI_TOP_K || '40', 10),
                    frequencyPenalty: 0.5,
                    presencePenalty: 0.1,
                },
                ...(options?.systemPrompt && {
                    systemInstruction: options.systemPrompt,
                }),
            })
            const result = await model.generateContent(prompt)
            return result.response.text()
        })
    }

    // ─── Streaming ──────────────────────────────────────────────
    async streamCompletion(
        prompt: string,
        systemPrompt: string,
        onChunk: (chunk: string) => void,
        options?: { maxTokens?: number; temperature?: number },
        signal?: AbortSignal
    ): Promise<void> {
        const model = this.genAI.getGenerativeModel({
            model: this.chatModel,
            systemInstruction: systemPrompt,
            generationConfig: {
                maxOutputTokens: options?.maxTokens ?? parseInt(env.AI_MAX_TOKENS || '2048', 10),
                temperature: options?.temperature ?? parseFloat(env.AI_TEMPERATURE || '0.7'),
                topP: parseFloat(env.AI_TOP_P || '0.9'),
                topK: parseInt(env.AI_TOP_K || '40', 10),
                frequencyPenalty: 0.5,
                presencePenalty: 0.1,
            },
        })
        const result = await model.generateContentStream(prompt)
        for await (const chunk of result.stream) {
            if (signal?.aborted) break
            const text = chunk.text()
            if (text) onChunk(text)
        }
    }

    // ─── Document Metadata (Gemini-native multimodal) ───────────
    async generateDocumentMetadata(
        input: { text?: string; fileBuffer?: Buffer; imageBase64?: string; fileName: string }
    ): Promise<DocumentMetadata> {
        const model = this.genAI.getGenerativeModel({ model: this.chatModel })

        const PROMPT = `Analyze this document and return ONLY valid JSON (no markdown fences). 
    IMPORTANT: DO NOT USE ANY MARKDOWN OR STARS (no **, no *). USE PLAIN TEXT ONLY. 
    For lists, use numbered format (1., 2., 3.) or letters (a., b.) instead of bullet points.
{
  "title": "concise document title in the document's language (max 80 chars)",
  "summary": "2-3 paragraph summary (max 200 words)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "language": "id or en or mixed",
  "docType": "sop or policy or guide or report or regulation or other"
}`

        let result
        if (input.fileBuffer) {
            // Gemini multimodal: send PDF directly without pre-extraction
            result = await model.generateContent([
                {
                    inlineData: {
                        data: input.fileBuffer.toString('base64'),
                        mimeType: 'application/pdf',
                    },
                },
                PROMPT,
            ])
        } else if (input.imageBase64) {
            // Gemini multimodal: send compressed image directly
            const base64Clean = input.imageBase64.replace(/^data:image\/\w+;base64,/, '')
            const mimeMatch = input.imageBase64.match(/^data:(image\/\w+);base64,/)
            const mimeType = mimeMatch?.[1] || 'image/jpeg'

            result = await model.generateContent([
                {
                    inlineData: {
                        data: base64Clean,
                        mimeType,
                    },
                },
                `This is an image document named "${input.fileName}". ${PROMPT}`,
            ])
        } else {
            result = await model.generateContent(
                `Document "${input.fileName}":\n${input.text?.slice(0, 30000)}\n\n${PROMPT}`
            )
        }

        const raw = result.response.text().trim()
        // Strip markdown fences if present
        const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

        try {
            return JSON.parse(clean) as DocumentMetadata
        } catch (parseError) {
            logger.error('Failed to parse Gemini metadata response:', raw)
            // Fallback metadata
            return {
                title: input.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
                summary: input.text?.slice(0, 200) ?? 'Document summary not available',
                tags: ['document'],
                language: 'id',
                docType: 'other',
            }
        }
    }

    // ─── Image Description (Vision/Multimodal) ────────────────
    async describeImage(base64Data: string, context?: string): Promise<string> {
        const model = this.genAI.getGenerativeModel({ model: this.chatModel })

        // Strip data URL prefix if present
        const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')
        const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/)
        const mimeType = mimeMatch?.[1] || 'image/jpeg'

        const prompt = context
            ? `Analyze and describe this image in detail. Context: this image is part of a knowledge article about "${context}". Describe what you see, including any text, diagrams, charts, tables, or visual information. Respond in Bahasa Indonesia.`
            : `Analyze and describe this image in detail. Describe what you see, including any text, diagrams, charts, tables, or visual information. Respond in Bahasa Indonesia.`

        const result = await model.generateContent([
            { inlineData: { data: base64Clean, mimeType } },
            prompt,
        ])

        return result.response.text()
    }

    // ─── Audio Transcription (Audio/Speech-to-Text) ────────────
    async transcribeAudio(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
        const model = this.genAI.getGenerativeModel({ model: this.chatModel })
        
        try {
            const prompt = `Please transcribe this audio file accurately in its original language. Do not summarize, just provide the exact transcription of what is spoken.`
            
            const result = await model.generateContent([
                {
                    inlineData: {
                        data: fileBuffer.toString('base64'),
                        mimeType: mimeType || 'audio/mpeg',
                    },
                },
                prompt,
            ])
            
            return result.response.text().trim()
        } catch (error: any) {
            logger.error(`Gemini audio transcription failed for ${fileName}:`, error.message)
            throw new Error(`Voice transcription failed: ${error.message}`)
        }
    }

    async rerank(query: string, documents: string[]): Promise<{ index: number; score: number }[]> {
        // Gemini does not have a native Rerank API yet.
        // Return original order with a mock score.
        return documents.map((_, index) => ({
            index,
            score: 0.99 - (index * 0.01)
        }))
    }
}
