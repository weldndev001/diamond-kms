// app/api/monitoring/instances/[id]/route.ts
// Returns a single client instance with simulated historical data
import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

function jitter(val: number, range: number, min = 0, max = 100): number {
    const delta = (Math.random() - 0.5) * 2 * range
    return Math.max(min, Math.min(max, Math.round((val + delta) * 10) / 10))
}

/** Generate simulated historical data points */
function generateHistory(baseValue: number, points: number, range: number, min = 0, max = 100): number[] {
    const data: number[] = []
    let current = baseValue
    for (let i = 0; i < points; i++) {
        current = Math.max(min, Math.min(max, current + (Math.random() - 0.5) * range * 2))
        data.push(Math.round(current * 10) / 10)
    }
    return data
}

function generateTimestamps(points: number, intervalMinutes: number): string[] {
    const now = Date.now()
    return Array.from({ length: points }, (_, i) =>
        new Date(now - (points - 1 - i) * intervalMinutes * 60000).toISOString()
    )
}

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params
        const inst = await (prisma as any).clientInstance.findUnique({ where: { id } })

        if (!inst) {
            return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
        }

        const isAlive = inst.status !== 'offline'
        const historyPoints = 30 // 30 data points
        const timestamps = generateTimestamps(historyPoints, 5) // every 5 minutes

        // Generate simulated history for key metrics
        const history = {
            timestamps,
            cpu: isAlive ? generateHistory(inst.cpu_percent, historyPoints, 5) : Array(historyPoints).fill(0),
            memory: isAlive ? generateHistory(inst.memory_percent, historyPoints, 3) : Array(historyPoints).fill(0),
            disk: isAlive ? generateHistory(inst.disk_percent, historyPoints, 0.5, 0, 100) : Array(historyPoints).fill(0),
            response_ms: isAlive ? generateHistory(inst.ai_avg_response_ms, historyPoints, 400, 100, 10000) : Array(historyPoints).fill(0),
            success_rate: isAlive ? generateHistory(inst.ai_success_rate, historyPoints, 2, 50, 100) : Array(historyPoints).fill(0),
            dau: isAlive ? generateHistory(inst.dau_today, historyPoints, 3, 0, inst.total_users) : Array(historyPoints).fill(0),
            errors: isAlive ? generateHistory(inst.errors_total_24h, historyPoints, 2, 0, 50) : Array(historyPoints).fill(0),
            health_score: isAlive ? generateHistory(inst.health_score, historyPoints, 3, 0, 100) : Array(historyPoints).fill(0),
        }

        // Current values with jitter
        const current = {
            ...inst,
            status: inst.status,
            cpu_percent: isAlive ? jitter(inst.cpu_percent, 5) : 0,
            memory_percent: isAlive ? jitter(inst.memory_percent, 3) : 0,
            disk_percent: isAlive ? jitter(inst.disk_percent, 1, 0, 100) : 0,
            ai_avg_response_ms: isAlive ? Math.round(jitter(inst.ai_avg_response_ms, 300, 100, 10000)) : 0,
            ai_success_rate: isAlive ? jitter(inst.ai_success_rate, 2, 50, 100) : 0,
            health_score: isAlive ? jitter(inst.health_score, 3, 0, 100) : 0,
            dau_today: isAlive ? Math.round(jitter(inst.dau_today, 3, 0, inst.total_users)) : 0,
            errors_total_24h: isAlive ? Math.round(jitter(inst.errors_total_24h, 2, 0, 50)) : 0,
            errors_error_24h: isAlive ? Math.round(jitter(inst.errors_error_24h, 1, 0, 30)) : 0,
            errors_warn_24h: isAlive ? Math.round(jitter(inst.errors_warn_24h, 1, 0, 30)) : 0,
            minutes_since_heartbeat: isAlive ? Math.floor(Math.random() * 3) : 9999,
        }

        return NextResponse.json({ instance: current, history })
    } catch (error: any) {
        console.error('[Monitoring Detail API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
