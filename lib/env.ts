// lib/env.ts
// Typed environment variable access — single source of truth
// All server-side code imports env vars from here, NOT from process.env directly

function getEnv(key: string, required = false): string {
    const value = process.env[key] ?? ''
    if (required && !value) {
        throw new Error(`Missing required environment variable: ${key}`)
    }
    return value
}

export const env = {
    UPLOAD_DIR: getEnv('UPLOAD_DIR') || './uploads',

    // Database
    DATABASE_URL: getEnv('DATABASE_URL'),
    DIRECT_URL: getEnv('DIRECT_URL'),

    // AI Providers
    GEMINI_API_KEY: getEnv('GEMINI_API_KEY'),
    AI_PROVIDER: getEnv('AI_PROVIDER') || 'managed',
    AI_ENDPOINT: getEnv('AI_ENDPOINT') || 'https://llm01.weldn.ai/olla/openai/v1',
    AI_API_KEY: getEnv('AI_API_KEY'),
    AI_CHAT_MODEL: getEnv('AI_CHAT_MODEL'),
    AI_EMBED_MODEL: getEnv('AI_EMBED_MODEL'),
    AI_HYBRID_EMBED: getEnv('AI_HYBRID_EMBED') || 'false',
    AI_HYBRID_VISION: getEnv('AI_HYBRID_VISION') || 'true',
    AI_SIMILARITY_THRESHOLD: getEnv('AI_SIMILARITY_THRESHOLD') || '0.40',
    AI_TEMPERATURE: getEnv('AI_TEMPERATURE') || '0.7',
    AI_TOP_P: getEnv('AI_TOP_P') || '0.9',
    AI_TOP_K: getEnv('AI_TOP_K') || '40',
    AI_REPETITION_PENALTY: getEnv('AI_REPETITION_PENALTY') || '1.15',
    AI_MAX_TOKENS: getEnv('AI_MAX_TOKENS') || '2048',
    AI_RERANK_MODEL: getEnv('AI_RERANK_MODEL') || 'qwen3-reranker-0.6b-q8_0-ggmlorg.gguf',
    AI_VISION_EMBED_MODEL: getEnv('AI_VISION_EMBED_MODEL') || '',
    AI_AUDIO_MODEL: getEnv('AI_AUDIO_MODEL') || '',
    AI_EMBEDDING_DIMENSIONS: getEnv('AI_EMBEDDING_DIMENSIONS') || '1024',

    // Security
    CRON_SECRET: getEnv('CRON_SECRET'),
    ENCRYPTION_KEY: getEnv('ENCRYPTION_KEY'),

    // App
    NEXT_PUBLIC_APP_URL: getEnv('NEXT_PUBLIC_APP_URL'),
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',

    // Monitoring Center Integration
    INSTANCE_KEY: getEnv('INSTANCE_KEY') || 'DKMS-DEFAULT',
    INSTANCE_NAME: getEnv('INSTANCE_NAME') || 'Diamond KMS',
    MONITORING_CENTER_URL: getEnv('MONITORING_CENTER_URL') || '',

    // License & Activation
    LICENSE_KEY: getEnv('LICENSE_KEY') || '',
    LICENSE_SECRET: getEnv('LICENSE_SECRET') || '',
    ACTIVATION_MODE: getEnv('ACTIVATION_MODE') || 'offline',
} as const
