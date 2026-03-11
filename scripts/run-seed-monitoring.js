// scripts/run-seed-monitoring.js
// Direct seeder — reads .env manually for DATABASE_URL
const fs = require('fs')
const path = require('path')

// Load .env manually
const envPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
        const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
        if (match) {
            let val = match[2]
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
            if (!process.env[match[1]]) process.env[match[1]] = val
        }
    }
}

const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const demoInstances = [
    {
        instance_key: 'inst-pt-abc-001',
        client_name: 'PT ABC Corporation',
        app_version: '2.1.0',
        status: 'online',
        last_heartbeat: new Date(Date.now() - 3 * 60000),
        cpu_percent: 62, memory_percent: 48, disk_percent: 78, uptime_seconds: 1314000,
        db_status: 'connected', db_size_mb: 2340, db_connections: 12,
        total_users: 45, total_divisions: 6, total_documents: 234, total_contents: 89, docs_pending: 2, docs_failed: 1,
        ai_provider: 'self_hosted', ai_model: 'llama3.3:70b', ai_status: 'healthy',
        ai_avg_response_ms: 2300, ai_success_rate: 97.2, ai_tokens_30d: 124500,
        embedding_total: 234, embedding_done: 231, embedding_failed: 1,
        dau_today: 28, chat_sessions_7d: 156, quiz_completions_7d: 34, read_rate: 78, avg_quiz_score: 82, approval_pending: 3,
        errors_total_24h: 7, errors_error_24h: 2, errors_warn_24h: 5, health_score: 92,
        latest_errors: [
            { level: 'ERROR', source: 'API /chat', message: 'Ollama timeout after 30s', created_at: new Date(Date.now() - 15 * 60000).toISOString() },
            { level: 'WARN', source: 'DB', message: 'Slow query: vector search 3.2s', created_at: new Date(Date.now() - 90 * 60000).toISOString() },
        ],
        license_plan: 'enterprise', license_expires: new Date('2027-01-15'),
    },
    {
        instance_key: 'inst-cv-maju-001',
        client_name: 'CV Maju Sejahtera',
        app_version: '2.1.0',
        status: 'online',
        last_heartbeat: new Date(Date.now() - 1 * 60000),
        cpu_percent: 34, memory_percent: 52, disk_percent: 45, uptime_seconds: 864000,
        db_status: 'connected', db_size_mb: 1100, db_connections: 6,
        total_users: 8, total_divisions: 2, total_documents: 56, total_contents: 23, docs_pending: 0, docs_failed: 0,
        ai_provider: 'managed', ai_model: 'gemini-2.5-flash', ai_status: 'healthy',
        ai_avg_response_ms: 800, ai_success_rate: 100, ai_tokens_30d: 89000,
        embedding_total: 56, embedding_done: 56, embedding_failed: 0,
        dau_today: 6, chat_sessions_7d: 43, quiz_completions_7d: 12, read_rate: 92, avg_quiz_score: 88, approval_pending: 0,
        errors_total_24h: 1, errors_error_24h: 0, errors_warn_24h: 1, health_score: 99,
        latest_errors: [
            { level: 'WARN', source: 'Upload', message: 'File size close to limit: 9.2MB', created_at: new Date(Date.now() - 240 * 60000).toISOString() },
        ],
        license_plan: 'pro', license_expires: new Date('2026-06-01'),
    },
    {
        instance_key: 'inst-pt-xyz-001',
        client_name: 'PT XYZ Industries',
        app_version: '2.0.3',
        status: 'warning',
        last_heartbeat: new Date(Date.now() - 8 * 60000),
        cpu_percent: 89, memory_percent: 78, disk_percent: 91, uptime_seconds: 2592000,
        db_status: 'connected', db_size_mb: 4800, db_connections: 35,
        total_users: 120, total_divisions: 12, total_documents: 456, total_contents: 198, docs_pending: 5, docs_failed: 8,
        ai_provider: 'byok', ai_model: 'gpt-4o-mini', ai_status: 'degraded',
        ai_avg_response_ms: 5100, ai_success_rate: 72, ai_tokens_30d: 203000,
        embedding_total: 456, embedding_done: 443, embedding_failed: 8,
        dau_today: 45, chat_sessions_7d: 678, quiz_completions_7d: 8, read_rate: 45, avg_quiz_score: 65, approval_pending: 12,
        errors_total_24h: 20, errors_error_24h: 12, errors_warn_24h: 8, health_score: 40,
        latest_errors: [
            { level: 'ERROR', source: 'API /chat', message: 'OpenAI rate limit exceeded', created_at: new Date(Date.now() - 5 * 60000).toISOString() },
            { level: 'ERROR', source: 'RAG', message: 'Embedding failed: model overloaded', created_at: new Date(Date.now() - 30 * 60000).toISOString() },
            { level: 'WARN', source: 'System', message: 'Disk usage at 91%', created_at: new Date(Date.now() - 60 * 60000).toISOString() },
        ],
        license_plan: 'enterprise', license_expires: new Date('2027-03-20'),
    },
    {
        instance_key: 'inst-cv-down-001',
        client_name: 'CV Berkah Mandiri',
        app_version: '1.9.0',
        status: 'offline',
        last_heartbeat: new Date(Date.now() - 6 * 3600000),
        cpu_percent: 0, memory_percent: 0, disk_percent: 0, uptime_seconds: 0,
        db_status: 'disconnected', db_size_mb: 520, db_connections: 0,
        total_users: 5, total_divisions: 1, total_documents: 18, total_contents: 7, docs_pending: 0, docs_failed: 0,
        ai_provider: 'managed', ai_model: 'gemini-2.5-flash', ai_status: 'down',
        ai_avg_response_ms: 0, ai_success_rate: 0, ai_tokens_30d: 12000,
        embedding_total: 18, embedding_done: 18, embedding_failed: 0,
        dau_today: 0, chat_sessions_7d: 0, quiz_completions_7d: 0, read_rate: 60, avg_quiz_score: 70, approval_pending: 0,
        errors_total_24h: 0, errors_error_24h: 0, errors_warn_24h: 0, health_score: 0,
        latest_errors: null,
        license_plan: 'basic', license_expires: new Date('2026-04-15'),
    },
    {
        instance_key: 'inst-pt-def-001',
        client_name: 'PT DEF Teknologi',
        app_version: '2.1.0',
        status: 'online',
        last_heartbeat: new Date(Date.now() - 2 * 60000),
        cpu_percent: 45, memory_percent: 60, disk_percent: 55, uptime_seconds: 950400,
        db_status: 'connected', db_size_mb: 1850, db_connections: 15,
        total_users: 30, total_divisions: 4, total_documents: 167, total_contents: 64, docs_pending: 1, docs_failed: 0,
        ai_provider: 'self_hosted', ai_model: 'llama3.3:70b', ai_status: 'healthy',
        ai_avg_response_ms: 1900, ai_success_rate: 98.5, ai_tokens_30d: 95000,
        embedding_total: 167, embedding_done: 166, embedding_failed: 0,
        dau_today: 18, chat_sessions_7d: 210, quiz_completions_7d: 22, read_rate: 85, avg_quiz_score: 79, approval_pending: 1,
        errors_total_24h: 3, errors_error_24h: 0, errors_warn_24h: 3, health_score: 96,
        latest_errors: [
            { level: 'WARN', source: 'Auth', message: 'Multiple failed login attempts from IP 192.168.1.50', created_at: new Date(Date.now() - 120 * 60000).toISOString() },
        ],
        license_plan: 'enterprise', license_expires: new Date('2027-06-30'),
    },
    {
        instance_key: 'inst-pt-ghi-001',
        client_name: 'PT GHI Konsultan',
        app_version: '2.0.3',
        status: 'online',
        last_heartbeat: new Date(Date.now() - 4 * 60000),
        cpu_percent: 28, memory_percent: 35, disk_percent: 30, uptime_seconds: 604800,
        db_status: 'connected', db_size_mb: 650, db_connections: 4,
        total_users: 12, total_divisions: 3, total_documents: 78, total_contents: 31, docs_pending: 0, docs_failed: 0,
        ai_provider: 'managed', ai_model: 'gemini-2.5-flash', ai_status: 'healthy',
        ai_avg_response_ms: 950, ai_success_rate: 99.1, ai_tokens_30d: 45000,
        embedding_total: 78, embedding_done: 78, embedding_failed: 0,
        dau_today: 9, chat_sessions_7d: 87, quiz_completions_7d: 15, read_rate: 90, avg_quiz_score: 91, approval_pending: 2,
        errors_total_24h: 0, errors_error_24h: 0, errors_warn_24h: 0, health_score: 100,
        latest_errors: null,
        license_plan: 'pro', license_expires: new Date('2026-12-31'),
    },
]

async function main() {
    console.log('Seeding monitoring demo data...')
    for (const inst of demoInstances) {
        await prisma.clientInstance.upsert({
            where: { instance_key: inst.instance_key },
            create: inst,
            update: inst,
        })
        console.log('  OK:', inst.client_name, '(' + inst.status + ')')
    }
    console.log('Done! ' + demoInstances.length + ' client instances seeded.')
}

main().catch(console.error).finally(() => { pool.end(); prisma.$disconnect() })
