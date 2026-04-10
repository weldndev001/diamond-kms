// lib/ai/types.ts
// Interface contract for all AI providers
// Feature code ONLY imports from here — never import providers directly

export interface AIService {
    /** Generate embedding vector from text */
    generateEmbedding(text: string): Promise<number[]>

    /** Generate text (non-streaming) */
    generateCompletion(
        prompt: string,
        options?: {
            systemPrompt?: string
            maxTokens?: number
            jsonMode?: boolean
        }
    ): Promise<string>

    /** Generate text with streaming (for chatbot) */
    streamCompletion(
        prompt: string,
        systemPrompt: string,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<void>

    /** Extract metadata from document */
    generateDocumentMetadata(
        input: { text?: string; fileBuffer?: Buffer; fileName: string }
    ): Promise<DocumentMetadata>

    /** 
     * Rerank documents based on relevance to query 
     * Returns array of { index, score } ordered by relevance
     */
    rerank(
        query: string,
        documents: string[]
    ): Promise<{ index: number; score: number }[]>

    /** Provider name for logging */
    readonly providerName: string
    readonly embeddingModel: string
}

export interface DocumentMetadata {
    title: string
    summary: string
    tags: string[]
    language: 'id' | 'en' | 'mixed'
    docType: 'sop' | 'policy' | 'guide' | 'report' | 'regulation' | 'other'
}

/** Config stored in Organization.ai_provider_config (JSON column) */
export interface AIProviderConfig {
    provider: 'managed' | 'byok' | 'self_hosted'
    encryptedKey?: string   // AES-256-GCM encrypted API key (for byok/self_hosted)
    endpoint?: string       // Self-hosted endpoint URL
    chatModel?: string      // Model for chat/completion
    embedModel?: string     // Model for embeddings
}
