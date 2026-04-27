// lib/ai/providers/modelslab.ts
// Specialized provider for ModelsLab.com AI services
// Handles vision/multimodal (Gemma 4) and complex text tasks

import type { AIService, DocumentMetadata } from '../types'
import { logger } from '@/lib/logging/redact'
import { withRetry } from '../utils'
import { env } from '@/lib/env'

export interface ModelsLabConfig {
    apiKey: string
    endpoint: string     // e.g., https://modelslab.com/api/v6/llm/chat/completions
    modelId: string      // e.g., google-gemma-4-E2B-it
    providerName: string
}

export class ModelsLabService implements AIService {
    readonly providerName: string
    readonly embeddingModel: string
    private apiKey: string
    private endpoint: string
    private modelId: string

    constructor(config: ModelsLabConfig) {
        this.providerName = config.providerName || 'modelslab'
        this.apiKey = config.apiKey
        this.endpoint = config.endpoint
        this.modelId = config.modelId
        this.embeddingModel = 'n/a' // ModelsLab service instance usually focuses on Chat/Vision in this context
    }

    /**
     * ModelsLab specific implementation of generateCompletion.
     * Note: ModelsLab uses 'key' in the JSON body instead of Bearer token for some versions.
     */
    async generateCompletion(
        prompt: string,
        options?: { systemPrompt?: string; maxTokens?: number; jsonMode?: boolean; imageBase64?: string }
    ): Promise<string> {
        return withRetry(async () => {
            console.log(`[AI-MODELSLAB] Generating completion. Model: ${this.modelId}, Prompt length: ${prompt.length}`)
            const startTime = Date.now()

            const messages: any[] = []
            if (options?.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt })
            }
            
            // Handle multimodal (image) if provided
            if (options?.imageBase64) {
                messages.push({
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: options.imageBase64 } }
                    ]
                })
            } else {
                messages.push({ role: 'user', content: prompt })
            }

            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: this.apiKey, // ModelsLab specific auth
                        model_id: this.modelId,
                        messages: messages,
                        max_tokens: options?.maxTokens ?? 1024,
                        temperature: 0.7,
                        json_mode: options?.jsonMode ? true : false
                    })
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`ModelsLab request failed (${response.status}): ${errorText}`)
                }

                const data = await response.json()
                
                // ModelsLab response structure can vary, handle both native and OAI-like
                const content = data.choices?.[0]?.message?.content || data.output || ''
                
                console.log(`[AI-MODELSLAB] Completion finished in ${Date.now() - startTime}ms`)
                return content
            } catch (err: any) {
                console.error(`[AI-MODELSLAB] Completion Error:`, err.message)
                throw err
            }
        })
    }

    async generateEmbedding(text: string): Promise<number[]> {
        throw new Error('[AI-MODELSLAB] Embedding not implemented. Use Olla for embeddings.')
    }

    async streamCompletion(prompt: string, systemPrompt: string, onChunk: (chunk: string) => void): Promise<void> {
        // Simple non-streaming fallback for now
        const text = await this.generateCompletion(prompt, { systemPrompt })
        onChunk(text)
    }

    async generateDocumentMetadata(input: { text?: string; fileName: string; imageBase64?: string }): Promise<DocumentMetadata> {
        const content = input.text ?? `[File: ${input.fileName}]`
        const safeContent = content.slice(0, 5000)
        
        try {
            const raw = await this.generateCompletion(
                `Analyze this document: ${input.fileName}\nContent: ${safeContent}`,
                {
                    systemPrompt: 'You are a document analyzer. Return ONLY valid JSON with fields: title, summary, tags (array), language, docType.',
                    jsonMode: true,
                    imageBase64: input.imageBase64
                }
            )
            return JSON.parse(raw) as DocumentMetadata
        } catch (err) {
            return {
                title: input.fileName,
                summary: 'Analysis failed, using fallback.',
                tags: ['document'],
                language: 'id',
                docType: 'other'
            }
        }
    }

    async describeImage(base64Data: string, context?: string): Promise<string> {
        return this.generateCompletion(
            context ? `Describe this image in context of: ${context}` : 'Describe this image in detail.',
            { imageBase64: base64Data }
        )
    }

    async rerank(query: string, documents: string[]): Promise<{ index: number; score: number }[]> {
        return documents.map((_, i) => ({ index: i, score: 0.5 }))
    }
}
