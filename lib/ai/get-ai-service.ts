// lib/ai/get-ai-service.ts
// Factory — the only place that knows how to instantiate each provider
import { env } from '@/lib/env'
import { decrypt } from '@/lib/security/key-encryptor'
import { GeminiService } from './providers/gemini'
import { OpenAICompatService } from './providers/openai-compat'
import type { AIProviderConfig, AIService } from './types'

// Default Olla load balancer endpoint (self-hosted)
const OLLA_DEFAULT = 'https://llm01.weldn.ai/olla/openai/v1'

import { appendFileSync } from 'fs'
import { join } from 'path'

export function getAIService(config: AIProviderConfig): AIService {
    const logMsg = `[${new Date().toISOString()}] [AI-FACTORY] BASE CONFIG: ${JSON.stringify(config)}\n`
    appendFileSync(join(process.cwd(), 'ai-debug.log'), logMsg)
    
    const provider = process.env.AI_PROVIDER || config.provider || 'managed'

    switch (provider) {
        case 'managed': {
            const key = process.env.AI_API_KEY || env.GEMINI_API_KEY
            if (!key) throw new Error('Managed Auth Key not configured via ENV or DB')
            return new GeminiService(key, process.env.AI_CHAT_MODEL || config.chatModel || 'gemini-2.5-flash')
        }

        case 'byok': {
            const rawKey = process.env.AI_API_KEY || (config.encryptedKey ? decrypt(config.encryptedKey) : '')
            if (!rawKey) throw new Error('API key not configured for BYOK in ENV or DB')
            // Auto-detect: OpenAI keys start with 'sk-'
            if (rawKey.startsWith('sk-')) {
                return new OpenAICompatService({
                    baseURL: process.env.AI_ENDPOINT || 'https://api.openai.com/v1',
                    apiKey: rawKey,
                    chatModel: process.env.AI_CHAT_MODEL || config.chatModel || 'gpt-4o-mini',
                    embedModel: process.env.AI_EMBED_MODEL || config.embedModel || 'text-embedding-3-small',
                    providerName: 'openai',
                })
            } else {
                return new GeminiService(rawKey, process.env.AI_CHAT_MODEL || config.chatModel || 'gemini-2.5-flash')
            }
        }

        case 'self_hosted': {
            // Ollama often doesn't need an API key, so we make it optional
            const apiKey = process.env.AI_API_KEY || (config.encryptedKey ? decrypt(config.encryptedKey) : 'ollama-dummy-key')

            const service = new OpenAICompatService({
                baseURL: process.env.AI_ENDPOINT || config.endpoint || OLLA_DEFAULT,
                apiKey,
                chatModel: process.env.AI_CHAT_MODEL || config.chatModel || 'llama3.3:70b',
                embedModel: process.env.AI_EMBED_MODEL || config.embedModel || 'nomic-embed-text',
                providerName: 'ollama-self-hosted',
            })

            // Hybrid Injection: Use Gemini ONLY for embeddings
            if (process.env.AI_HYBRID_EMBED === 'true' && env.GEMINI_API_KEY) {
                console.log("[AI-FACTORY] HYBRID MODE AKTIF: Chat via Olla, Embedding via Google Gemini!")
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

    const config = (org?.ai_provider_config as AIProviderConfig | null)
    if (!config) {
        throw new Error(`[AI-FACTORY] Provider AI belum dikonfigurasi untuk organisasi ini.`)
    }
    
    return getAIService(config)
}
