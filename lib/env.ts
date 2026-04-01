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
    // Storage (Local Filesystem)
    UPLOAD_DIR: getEnv('UPLOAD_DIR') || './uploads',

    // Database
    DATABASE_URL: getEnv('DATABASE_URL'),
    DIRECT_URL: getEnv('DIRECT_URL'),

    // AI Providers
    GEMINI_API_KEY: getEnv('GEMINI_API_KEY'),

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
} as const
