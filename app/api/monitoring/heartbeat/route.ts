// app/api/monitoring/heartbeat/route.ts
// Receives heartbeat data from on-premise Diamond KMS instances
import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { instance_key, client_name, ...data } = body

        if (!instance_key || !client_name) {
            return NextResponse.json(
                { error: 'instance_key and client_name are required' },
                { status: 400 }
            )
        }

        // Determine status based on data health indicators
        let status = 'online'
        if (data.system?.cpu_percent > 90 || data.system?.disk_percent > 90) {
            status = 'warning'
        }
        if (data.ai?.status === 'down' || data.database?.status === 'disconnected') {
            status = 'warning'
        }

        // Upsert: create or update the client instance
        const instance = await prisma.clientInstance.upsert({
            where: { instance_key },
            create: {
                instance_key,
                client_name,
                app_version: data.version ?? '1.0.0',
                status,
                last_heartbeat: new Date(),
                // System
                cpu_percent: data.system?.cpu_percent ?? 0,
                memory_percent: data.system?.memory_percent ?? 0,
                disk_percent: data.system?.disk_percent ?? 0,
                uptime_seconds: data.system?.uptime_seconds ?? 0,
                // Database
                db_status: data.database?.status ?? 'unknown',
                db_size_mb: data.database?.size_mb ?? 0,
                db_connections: data.database?.active_connections ?? 0,
                // Data
                total_users: data.data?.users ?? 0,
                total_divisions: data.data?.divisions ?? 0,
                total_documents: data.data?.documents ?? 0,
                total_contents: data.data?.contents ?? 0,
                docs_pending: data.data?.docs_pending ?? 0,
                docs_failed: data.data?.docs_failed ?? 0,
                // AI
                ai_provider: data.ai?.provider ?? 'unknown',
                ai_model: data.ai?.model ?? 'unknown',
                ai_status: data.ai?.status ?? 'unknown',
                ai_avg_response_ms: data.ai?.avg_response_ms ?? 0,
                ai_success_rate: data.ai?.success_rate ?? 0,
                ai_tokens_30d: data.ai?.tokens_30d ?? 0,
                embedding_total: data.ai?.embedding_total ?? 0,
                embedding_done: data.ai?.embedding_done ?? 0,
                embedding_failed: data.ai?.embedding_failed ?? 0,
                // Engagement
                dau_today: data.engagement?.dau_today ?? 0,
                chat_sessions_7d: data.engagement?.chat_sessions_7d ?? 0,
                quiz_completions_7d: data.engagement?.quiz_completions_7d ?? 0,
                read_rate: data.engagement?.read_rate ?? 0,
                avg_quiz_score: data.engagement?.avg_quiz_score ?? 0,
                approval_pending: data.engagement?.approval_pending ?? 0,
                // Errors
                errors_total_24h: data.errors?.count_24h ?? 0,
                errors_error_24h: data.errors?.by_level?.ERROR ?? 0,
                errors_warn_24h: data.errors?.by_level?.WARN ?? 0,
                health_score: data.errors?.health_score ?? 100,
                latest_errors: data.errors?.latest ?? null,
                // License
                license_plan: data.license?.plan ?? 'basic',
                license_expires: data.license?.expires ? new Date(data.license.expires) : null,
            },
            update: {
                client_name,
                app_version: data.version ?? undefined,
                status,
                last_heartbeat: new Date(),
                // System
                cpu_percent: data.system?.cpu_percent ?? 0,
                memory_percent: data.system?.memory_percent ?? 0,
                disk_percent: data.system?.disk_percent ?? 0,
                uptime_seconds: data.system?.uptime_seconds ?? 0,
                // Database
                db_status: data.database?.status ?? 'unknown',
                db_size_mb: data.database?.size_mb ?? 0,
                db_connections: data.database?.active_connections ?? 0,
                // Data
                total_users: data.data?.users ?? 0,
                total_divisions: data.data?.divisions ?? 0,
                total_documents: data.data?.documents ?? 0,
                total_contents: data.data?.contents ?? 0,
                docs_pending: data.data?.docs_pending ?? 0,
                docs_failed: data.data?.docs_failed ?? 0,
                // AI
                ai_provider: data.ai?.provider ?? undefined,
                ai_model: data.ai?.model ?? undefined,
                ai_status: data.ai?.status ?? 'unknown',
                ai_avg_response_ms: data.ai?.avg_response_ms ?? 0,
                ai_success_rate: data.ai?.success_rate ?? 0,
                ai_tokens_30d: data.ai?.tokens_30d ?? 0,
                embedding_total: data.ai?.embedding_total ?? 0,
                embedding_done: data.ai?.embedding_done ?? 0,
                embedding_failed: data.ai?.embedding_failed ?? 0,
                // Engagement
                dau_today: data.engagement?.dau_today ?? 0,
                chat_sessions_7d: data.engagement?.chat_sessions_7d ?? 0,
                quiz_completions_7d: data.engagement?.quiz_completions_7d ?? 0,
                read_rate: data.engagement?.read_rate ?? 0,
                avg_quiz_score: data.engagement?.avg_quiz_score ?? 0,
                approval_pending: data.engagement?.approval_pending ?? 0,
                // Errors
                errors_total_24h: data.errors?.count_24h ?? 0,
                errors_error_24h: data.errors?.by_level?.ERROR ?? 0,
                errors_warn_24h: data.errors?.by_level?.WARN ?? 0,
                health_score: data.errors?.health_score ?? 100,
                latest_errors: data.errors?.latest ?? undefined,
                // License
                license_plan: data.license?.plan ?? undefined,
                license_expires: data.license?.expires ? new Date(data.license.expires) : undefined,
            },
        })

        return NextResponse.json({ ok: true, id: instance.id })
    } catch (error: any) {
        console.error('[Heartbeat API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
