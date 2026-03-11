// app/api/monitoring/instances/route.ts
// Returns all client instances with simulated real-time jitter
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/** Add random jitter: value ± range, clamped to [min, max] */
function jitter(val: number, range: number, min = 0, max = 100): number {
    const delta = (Math.random() - 0.5) * 2 * range
    return Math.max(min, Math.min(max, Math.round((val + delta) * 10) / 10))
}

function jitterInt(val: number, range: number, min = 0, max = 999999): number {
    return Math.round(jitter(val, range, min, max))
}

export async function GET() {
    try {
        const instances = await (prisma as any).clientInstance.findMany({
            orderBy: { client_name: 'asc' },
        })

        const now = Date.now()

        const processed = instances.map((inst: any) => {
            // Use the ORIGINAL seeded status to decide if this instance should appear alive
            // This way, even if seed was run hours ago, "online" instances stay online
            const originalStatus = inst.status as string
            const isAlive = originalStatus !== 'offline'

            // Determine display status — keep the original intent
            let status = originalStatus
            // Randomly flicker warning instances between warning and online for realism
            if (originalStatus === 'warning' && Math.random() > 0.7) {
                status = 'online'
            }

            // Simulate fresh heartbeat for alive instances
            const simulatedHeartbeat = isAlive
                ? new Date(now - Math.floor(Math.random() * 3 * 60000))
                : inst.last_heartbeat
            const minutesSince = isAlive
                ? Math.floor(Math.random() * 3)
                : inst.last_heartbeat
                    ? Math.round((now - new Date(inst.last_heartbeat).getTime()) / 60000)
                    : 9999

            return {
                ...inst,
                status,
                minutes_since_heartbeat: minutesSince,
                last_heartbeat: simulatedHeartbeat,

                // System resources — fluctuate ±5%
                cpu_percent:    isAlive ? jitter(inst.cpu_percent, 5) : 0,
                memory_percent: isAlive ? jitter(inst.memory_percent, 3) : 0,
                disk_percent:   isAlive ? jitter(inst.disk_percent, 1, 0, 100) : 0,
                uptime_seconds: isAlive ? inst.uptime_seconds + Math.floor(Math.random() * 300) : 0,

                // DB connections wobble
                db_connections: isAlive ? jitterInt(inst.db_connections, 3, 1) : 0,

                // AI response time fluctuates ±300ms
                ai_avg_response_ms: isAlive ? jitterInt(inst.ai_avg_response_ms, 300, 100, 10000) : 0,
                ai_success_rate:    isAlive ? jitter(inst.ai_success_rate, 2, 50, 100) : 0,

                // Token usage grows slowly
                ai_tokens_30d: isAlive ? jitterInt(inst.ai_tokens_30d, 500, 0) : inst.ai_tokens_30d,

                // DAU & engagement fluctuate
                dau_today:           isAlive ? jitterInt(inst.dau_today, 3, 0, inst.total_users) : 0,
                chat_sessions_7d:    isAlive ? jitterInt(inst.chat_sessions_7d, 5, 0) : 0,
                quiz_completions_7d: isAlive ? jitterInt(inst.quiz_completions_7d, 2, 0) : 0,
                read_rate:           isAlive ? jitter(inst.read_rate, 3, 0, 100) : inst.read_rate,
                avg_quiz_score:      isAlive ? jitter(inst.avg_quiz_score, 2, 0, 100) : inst.avg_quiz_score,

                // Error counts wobble slightly
                errors_total_24h: isAlive ? jitterInt(inst.errors_total_24h, 2, 0) : 0,
                errors_error_24h: isAlive ? jitterInt(inst.errors_error_24h, 1, 0) : 0,
                errors_warn_24h:  isAlive ? jitterInt(inst.errors_warn_24h, 1, 0) : 0,

                // Health score wobbles
                health_score: isAlive ? jitter(inst.health_score, 3, 0, 100) : 0,
            }
        })

        const summary = {
            total: processed.length,
            online: processed.filter((i: any) => i.status === 'online').length,
            offline: processed.filter((i: any) => i.status === 'offline').length,
            warning: processed.filter((i: any) => i.status === 'warning').length,
        }

        return NextResponse.json({ summary, instances: processed })
    } catch (error: any) {
        console.error('[Monitoring API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
