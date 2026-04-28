// lib/ai/providers/openai-compat.ts
// OpenAI-compatible provider — works with OpenRouter AND Ollama via Olla
import OpenAI from 'openai'
import type { AIService, DocumentMetadata } from '../types'
import { logger } from '@/lib/logging/redact'
import { withRetry } from '../utils'
import { env } from '@/lib/env'

export interface OpenAICompatConfig {
    baseURL: string      // 'https://openrouter.ai/api/v1' or Olla endpoint
    apiKey: string
    chatModel: string    // 'google/gemini-2.5-flash', 'llama3.3:70b', etc.
    embedModel: string   // 'nomic-embed-text', or fallback to Gemini
    visionEmbedModel?: string // 'qwen3-vl-embedding-2b' for multimodal embedding
    providerName: string
}

export class OpenAICompatService implements AIService {
    readonly providerName: string
    readonly embeddingModel: string
    readonly visionEmbedModel?: string
    private client: OpenAI
    private chatModel: string

    constructor(config: OpenAICompatConfig) {
        this.providerName = config.providerName
        this.embeddingModel = config.embedModel
        this.visionEmbedModel = config.visionEmbedModel
        this.chatModel = config.chatModel
        this.client = new OpenAI({
            baseURL: config.baseURL,
            apiKey: config.apiKey,
            defaultHeaders: {
                // OpenRouter requires these headers
                'HTTP-Referer': 'https://diamond-kms.app',
                'X-Title': 'DIAMOND KMS',
            },
        })
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (this.visionEmbedModel && this.embeddingModel === this.visionEmbedModel) {
            return this.generateVisionQueryEmbedding(text);
        }

        return withRetry(async () => {
            try {
                // console.log(`[AI-SELFHOSTED] Generating embedding for text length: ${text.length}`)
                const response = await this.client.embeddings.create({
                    model: this.embeddingModel,
                    input: text,
                })
                const embedding = response.data[0]?.embedding
                if (!embedding) throw new Error('No embedding returned from provider')
                return embedding
            } catch (err: any) {
                console.error(`[AI-SELFHOSTED] Embedding Error:`, err.message)
                throw err
            }
        })
    }

    async generateCompletion(
        prompt: string,
        options?: { systemPrompt?: string; maxTokens?: number; jsonMode?: boolean }
    ): Promise<string> {
        return withRetry(async () => {
            const baseUrl = (this.client as any).baseURL
            console.log(`[AI-CLIENT] Using baseURL: ${baseUrl}, model: ${this.chatModel}`)
            console.log(`[AI-SELFHOSTED] Generating completion. Model: ${this.chatModel}, Prompt length: ${prompt.length}`)
            const startTime = Date.now()
            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
            if (options?.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt })
            }
            messages.push({ role: 'user', content: prompt })

            const requestBody: any = {
                model: this.chatModel,
                max_tokens: options?.maxTokens ?? parseInt(env.AI_MAX_TOKENS || '2048', 10),
                response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
                messages,
                temperature: parseFloat(env.AI_TEMPERATURE || '0.7'),
                top_p: parseFloat(env.AI_TOP_P || '0.9'),
                // top_k: parseInt(env.AI_TOP_K || '40', 10), // Optional in standard OpenAI, but works in ollama/openrouter
                frequency_penalty: 0.5,
                presence_penalty: 0.1,
                repetition_penalty: parseFloat(env.AI_REPETITION_PENALTY || '1.15'),
            }

            try {
                const response = await this.client.chat.completions.create(requestBody)
                console.log(`[AI-SELFHOSTED] Completion finished in ${Date.now() - startTime}ms`)
                return response.choices[0]?.message.content ?? ''
            } catch (err: any) {
                console.error(`[AI-SELFHOSTED] Completion Error after ${Date.now() - startTime}ms:`, err.message)
                throw err
            }
        })
    }

    async streamCompletion(
        prompt: string,
        systemPrompt: string,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const requestBody: any = {
            model: this.chatModel,
            stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: parseFloat(env.AI_TEMPERATURE || '0.7'),
            top_p: parseFloat(env.AI_TOP_P || '0.9'),
            frequency_penalty: 0.5,
            presence_penalty: 0.1,
            repetition_penalty: parseFloat(env.AI_REPETITION_PENALTY || '1.15'),
        }

        const stream = await this.client.chat.completions.create(
            requestBody,
            { signal }
        ) as unknown as AsyncIterable<any>
        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta.content ?? ''
            if (text) onChunk(text)
        }
    }

    async generateDocumentMetadata(
        input: { text?: string; fileBuffer?: Buffer; imageBase64?: string; fileName: string }
    ): Promise<DocumentMetadata> {
        const content = input.text ?? `[File: ${input.fileName}]`
        const safeContent = content.slice(0, 2500)
        console.log(`[AI-SELFHOSTED] Generating metadata for document: ${input.fileName}, text length: ${safeContent.length}`)
        
        try {
            const raw = await this.generateCompletion(
                `Document content:\n${safeContent}`,
                {
                    systemPrompt:
                        'You analyze documents. Return ONLY valid JSON with fields: title (string, max 80 chars), summary (string, 2-3 paragraphs), tags (string array, 5 items), language ("id"|"en"|"mixed"), docType ("sop"|"policy"|"guide"|"report"|"regulation"|"other"). IMPORTANT: DO NOT USE ANY MARKDOWN OR STARS (no **, no *). USE PLAIN TEXT ONLY. For lists, use numbered format (1., 2.) or letters (a., b.) instead of bullet points.',
                    jsonMode: true,
                }
            )

            const parsed = JSON.parse(raw) as DocumentMetadata
            console.log(`[AI-SELFHOSTED] Metadata parse SUCCESS:`, parsed.title)
            return parsed
        } catch (error: any) {
            logger.error('Failed to parse (or generate) metadata response:', error.message || error)
            console.log(`[AI-SELFHOSTED] Metadata generation FAILED, using fallback.`)
            return {
                title: input.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
                summary: content.slice(0, 200),
                tags: ['document'],
                language: 'id',
                docType: 'other',
            }
        }
    }

    async describeImage(base64Data: string, context?: string): Promise<string> {
        try {
            // Ensure proper data URL format
            const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/)
            const imageUrl = mimeMatch ? base64Data : `data:image/jpeg;base64,${base64Data}`

            const prompt = context
                ? `Analyze and describe this image in detail. Context: this image is part of a knowledge article about "${context}". Describe what you see, including any text, diagrams, charts, tables, or visual information. Respond in Bahasa Indonesia.`
                : `Analyze and describe this image in detail. Describe what you see, including any text, diagrams, charts, tables, or visual information. Respond in Bahasa Indonesia.`

            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ]
                }
            ]

            console.log(`[AI-SELFHOSTED] Analyzing image with vision model: ${this.chatModel}`)
            const startTime = Date.now()

            const response = await this.client.chat.completions.create({
                model: this.chatModel,
                messages,
                max_tokens: 500,
                temperature: 0.3, // Lower temperature for more factual descriptions
            })

            const description = response.choices[0]?.message.content ?? ''
            console.log(`[AI-SELFHOSTED] Image analysis completed in ${Date.now() - startTime}ms, description length: ${description.length}`)
            return description
        } catch (err: any) {
            console.error(`[AI-SELFHOSTED] Image analysis error:`, err.message)
            throw err
        }
    }

    async transcribeAudio(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
        return withRetry(async () => {
            console.log(`[AI-SELFHOSTED] Transcribing audio file: ${fileName}`)
            try {
                // Use the configured chat model (Gemma) for multimodal audio if AI_AUDIO_MODEL isn't specifically set
                const audioModel = env.AI_AUDIO_MODEL || this.chatModel || 'gemma-4-E2B-it-Q4_K_M-unsloth.gguf'
                
                // Convert Buffer to File object acceptable by openai SDK in Next.js
                // We use global File which is available in Next.js 13+ Node/Edge runtime
                const file = new File([fileBuffer], fileName, { type: mimeType || 'audio/mpeg' })
                
                const response = await this.client.audio.transcriptions.create({
                    file: file,
                    model: audioModel,
                    response_format: 'json',
                })
                
                // When response_format is 'json', OpenAI returns an object: { text: "..." }
                return (response as any).text as string
            } catch (err: any) {
                console.error(`[AI-SELFHOSTED] Audio Transcription Error:`, err.message)
                throw new Error(`Voice transcription failed: ${err.message}`)
            }
        })
    }

    async rerank(query: string, documents: string[]): Promise<{ index: number; score: number }[]> {
        return withRetry(async () => {
            const baseUrl = this.client.baseURL.replace(/\/$/, '')
            // Check if baseURL already contains /v1
            const url = baseUrl.includes('/v1') ? `${baseUrl}/rerank` : `${baseUrl}/v1/rerank`
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.client.apiKey}`
                    },
                    body: JSON.stringify({
                        model: env.AI_RERANK_MODEL,
                        query,
                        documents,
                        top_n: documents.length
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`Rerank request failed (${response.status}): ${errorText}`)
                }

                const data = await response.json()
                /**
                 * Standard Rerank API response format (Cohere/Jina style):
                 * { 
                 *   results: [ { index: 0, relevance_score: 0.98 }, ... ]
                 * }
                 */
                return data.results.map((r: any) => ({
                    index: r.index,
                    score: r.relevance_score
                }))
            } catch (err: any) {
                console.error(`[AI-SELFHOSTED] Rerank Error:`, err.message)
                throw err
            }
        })
    }

    // ─── Vision Embedding (Multimodal) ───────────────────────────

    /**
     * Generate embedding vector from an image using the VL embedding model.
     * Sends multimodal input (image) to /v1/embeddings endpoint.
     * Returns a 768-dim vector (truncated from model's native 2048 via MRL).
     */
    async generateImageEmbedding(base64Data: string): Promise<number[]> {
        if (!this.visionEmbedModel) {
            throw new Error('[AI-SELFHOSTED] Vision embed model not configured')
        }

        return withRetry(async () => {
            try {
                // Ensure proper data URL format
                const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/)
                const imageUrl = mimeMatch ? base64Data : `data:image/jpeg;base64,${base64Data}`

                const baseUrl = this.client.baseURL.replace(/\/$/, '')
                const url = baseUrl.includes('/v1') ? `${baseUrl}/embeddings` : `${baseUrl}/v1/embeddings`

                console.log(`[AI-SELFHOSTED] Generating image embedding with VL model: ${this.visionEmbedModel}`)
                const startTime = Date.now()

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.client.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.visionEmbedModel,
                        input: [
                            {
                                type: 'image_url',
                                image_url: { url: imageUrl }
                            }
                        ],
                        dimensions: 768
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`Image embedding request failed (${response.status}): ${errorText}`)
                }

                const data = await response.json()
                const embedding = data.data?.[0]?.embedding
                if (!embedding) throw new Error('No embedding returned from VL model')

                console.log(`[AI-SELFHOSTED] Image embedding generated in ${Date.now() - startTime}ms, dims: ${embedding.length}`)
                return embedding
            } catch (err: any) {
                console.error(`[AI-SELFHOSTED] Image Embedding Error:`, err.message)
                throw err
            }
        })
    }

    /**
     * Generate embedding for text query using the VL embedding model.
     * This allows cross-modal search (text query → image embedding space).
     */
    async generateVisionQueryEmbedding(text: string): Promise<number[]> {
        if (!this.visionEmbedModel) {
            throw new Error('[AI-SELFHOSTED] Vision embed model not configured')
        }

        return withRetry(async () => {
            try {
                const baseUrl = this.client.baseURL.replace(/\/$/, '')
                const url = baseUrl.includes('/v1') ? `${baseUrl}/embeddings` : `${baseUrl}/v1/embeddings`

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.client.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.visionEmbedModel,
                        input: text,
                        dimensions: 768
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`Vision query embedding failed (${response.status}): ${errorText}`)
                }

                const data = await response.json()
                const embedding = data.data?.[0]?.embedding
                if (!embedding) throw new Error('No embedding returned from VL model for text query')
                return embedding
            } catch (err: any) {
                console.error(`[AI-SELFHOSTED] Vision Query Embedding Error:`, err.message)
                throw err
            }
        })
    }
}
