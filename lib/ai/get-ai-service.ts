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
    const logMsg = `[${new Date().toISOString()}] [AI-FACTORY] FULL CONFIG: ${JSON.stringify(config)}\n`
    appendFileSync(join(process.cwd(), 'ai-debug.log'), logMsg)
    
    switch (config.provider) {
        case 'managed': {
            const key = env.GEMINI_API_KEY
            if (!key) throw new Error('GEMINI_API_KEY not configured')
            return new GeminiService(key, config.chatModel ?? 'gemini-2.5-flash')
        }

        case 'byok': {
            if (!config.encryptedKey) throw new Error('API key not configured for BYOK')
            const byokKey = decrypt(config.encryptedKey)
            // Auto-detect: OpenAI keys start with 'sk-'
            if (byokKey.startsWith('sk-')) {
                return new OpenAICompatService({
                    baseURL: 'https://api.openai.com/v1',
                    apiKey: byokKey,
                    chatModel: config.chatModel ?? 'gpt-4o-mini',
                    embedModel: config.embedModel ?? 'text-embedding-3-small',
                    providerName: 'openai',
                })
            } else {
                return new GeminiService(byokKey, config.chatModel ?? 'gemini-2.5-flash')
            }
        }

        case 'self_hosted': {
            // Ollama often doesn't need an API key, so we make it optional
            const apiKey = config.encryptedKey ? decrypt(config.encryptedKey) : 'ollama-dummy-key'

            return new OpenAICompatService({
                baseURL: config.endpoint ?? OLLA_DEFAULT,
                apiKey,
                chatModel: config.chatModel ?? 'llama3.3:70b',
                embedModel: config.embedModel ?? 'nomic-embed-text',
                providerName: 'ollama-olla',
            })
        }

        default: {
            throw new Error(`[AI-FACTORY] Provider '${config.provider}' tidak dikenali.`)
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
