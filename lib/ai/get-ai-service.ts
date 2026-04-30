// lib/ai/get-ai-service.ts
// Factory — the only place that knows how to instantiate each provider
import { env } from '@/lib/env'
import { decrypt } from '@/lib/security/key-encryptor'
import { GeminiService } from './providers/gemini'
import { OpenAICompatService } from './providers/openai-compat'
import { ModelsLabService } from './providers/modelslab'
import type { AIProviderConfig, AIService } from './types'

// Default Olla load balancer endpoint (self-hosted)
const OLLA_DEFAULT = 'https://llm01.weldn.ai/olla/openai/v1'

export function getAIService(config: AIProviderConfig): AIService {
    const provider = env.AI_PROVIDER || config.provider || 'managed'
    
    // Debug logging (safe, only first/last chars)
    const hasKey = !!(env.AI_API_KEY || env.GEMINI_API_KEY)
    console.log(`[AI-FACTORY] Provider: ${provider}, EnvKey: ${hasKey ? 'Present' : 'Missing'}`)

    switch (provider) {
        case 'managed': {
            const key = env.AI_API_KEY || env.GEMINI_API_KEY
            if (!key) throw new Error('Managed Auth Key not configured via ENV or DB')
            return new GeminiService(key, env.AI_CHAT_MODEL || config.chatModel || 'gemini-2.5-flash')
        }

        case 'byok': {
            const rawKey = env.AI_API_KEY || (config.encryptedKey ? decrypt(config.encryptedKey) : '')
            if (!rawKey) throw new Error('API key not configured for BYOK in ENV or DB')
            // Auto-detect: OpenAI keys start with 'sk-'
            if (rawKey.startsWith('sk-')) {
                return new OpenAICompatService({
                    baseURL: env.AI_ENDPOINT || 'https://api.openai.com/v1',
                    apiKey: rawKey,
                    chatModel: env.AI_CHAT_MODEL || config.chatModel || 'gpt-4o-mini',
                    embedModel: env.AI_EMBED_MODEL || config.embedModel || 'text-embedding-3-small',
                    providerName: 'openai',
                })
            } else {
                return new GeminiService(rawKey, env.AI_CHAT_MODEL || config.chatModel || 'gemini-2.5-flash')
            }
        }

        case 'self_hosted': {
            // Ollama often doesn't need an API key, so we make it optional
            const apiKey = env.AI_API_KEY || (config.encryptedKey ? decrypt(config.encryptedKey) : 'ollama-dummy-key')
            const baseUrl = env.AI_ENDPOINT || config.endpoint || OLLA_DEFAULT
            
            if (apiKey === 'ollama-dummy-key' && baseUrl.includes('weldn.ai')) {
                console.warn('⚠️ [AI-FACTORY] Using dummy key for weldn.ai endpoint! Check Vercel Env Vars.')
            }

            const service = new OpenAICompatService({
                baseURL: baseUrl,
                apiKey,
                chatModel: env.AI_CHAT_MODEL || config.chatModel || 'llama3.3:70b',
                embedModel: env.AI_EMBED_MODEL || config.embedModel || 'nomic-embed-text',
                visionEmbedModel: env.AI_VISION_EMBED_MODEL || undefined,
                providerName: 'ollama-self-hosted',
            })

            // Hybrid Injection: Use Gemini ONLY for embeddings
            if (env.AI_HYBRID_EMBED === 'true' && env.GEMINI_API_KEY) {
                console.log("[AI-FACTORY] HYBRID MODE AKTIF: Chat via Olla, Embedding via Google Gemini!")
                const gemini = new GeminiService(env.GEMINI_API_KEY)
                Object.defineProperty(service, 'embeddingModel', { value: gemini.embeddingModel, writable: true })
                service.generateEmbedding = async (text: string) => gemini.generateEmbedding(text)
            }

            return service
        }

        case 'modelslab': {
            const apiKey = process.env.AI_MODELSLAB_API_KEY || '' // Not in env.ts yet, keep as is or add to env.ts
            const service = new ModelsLabService({
                apiKey,
                endpoint: process.env.AI_MODELSLAB_ENDPOINT || 'https://modelslab.com/api/v6/llm/chat/completions',
                modelId: process.env.AI_MODELSLAB_MODEL || 'google-gemma-4-E2B-it',
                providerName: 'modelslab-primary',
            })

            // Hybrid Injection: Use Olla/Ollama ONLY for embeddings (Self-hosted is better for local vectors)
            const olla = new OpenAICompatService({
                baseURL: env.AI_ENDPOINT || OLLA_DEFAULT,
                apiKey: env.AI_API_KEY || 'ollama-dummy-key',
                chatModel: env.AI_CHAT_MODEL || 'llama3.3:70b',
                embedModel: env.AI_EMBED_MODEL || 'nomic-embed-text',
                visionEmbedModel: env.AI_VISION_EMBED_MODEL || undefined,
                providerName: 'ollama-embedding-sidecar',
            })

            // Override embedding and rerank methods to use Olla by default
            Object.defineProperty(service, 'embeddingModel', { value: olla.embeddingModel, writable: true })
            service.generateEmbedding = async (text: string) => olla.generateEmbedding(text)
            service.rerank = async (query, docs) => olla.rerank(query, docs)

            // OPTIONAL: Override with Gemini if Hybrid Mode is ON
            if (env.AI_HYBRID_EMBED === 'true' && env.GEMINI_API_KEY) {
                console.log("[AI-FACTORY] HYBRID MODE (MODELS-LAB): Chat via ModelsLab, Embedding via Google Gemini!")
                const gemini = new GeminiService(env.GEMINI_API_KEY)
                Object.defineProperty(service, 'embeddingModel', { value: gemini.embeddingModel, writable: true })
                service.generateEmbedding = async (text: string) => gemini.generateEmbedding(text)
            }

            return service
        }

        default: {
            throw new Error(`[AI-FACTORY] Provider '${provider}' tidak dikenali.`)
        }
    }
}

/**
 * Helper: get AI service from org config in DB
 * Use this in server actions and API routes
 */
export async function getAIServiceForOrg(orgId: string): Promise<AIService> {
    const prisma = (await import('@/lib/prisma')).default
    let org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, ai_provider_config: true },
    })

    if (!org) {
        throw new Error(`[AI-FACTORY] Konfigurasi AI untuk organisasi ${orgId} tidak ditemukan. Pastikan sudah diatur di AI Management.`)
    }

    // FALLBACK: If ai_provider_config is null, use empty object to trigger ENV fallback in getAIService
    const config = (org?.ai_provider_config as AIProviderConfig | null) || ({} as AIProviderConfig)
    
    return getAIService(config)
}
