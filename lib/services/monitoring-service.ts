import os from 'os'
import prisma from '@/lib/prisma'
import { env } from '@/lib/env'

export interface HeartbeatPayload {
    instance_key: string
    client_name: string
    app_version: string
    system: {
        cpu_percent: number
        memory_percent: number
        disk_percent: number
        uptime_seconds: number
    }
    database: {
        status: string
        size_mb: number
        connections: number
    }
    data: {
        total_users: number
        total_documents: number
        total_divisions: number
        total_contents: number
    }
    ai: {
        tokens_30d: number
        avg_response_ms: number
        success_rate: number
    }
    engagement: {
        dau_today: number
        chat_sessions_7d: number
    }
}

/**
 * Collects system, database, and application metrics for the heartbeat.
 */
export async function collectMetrics(): Promise<HeartbeatPayload> {
    // 1. System Metrics (Using Node.js 'os' module)
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const memory_percent = ((totalMem - freeMem) / totalMem) * 100
    
    // CPU Load (approximate using load average for 1 min)
    const cpus = os.cpus()
    const load = os.loadavg()[0]
    const cpu_percent = Math.min((load / cpus.length) * 100, 100)

    // 2. Database Metrics
    // Note: Database size query is dialect-specific (PostgreSQL)
    let dbSizeMb = 0
    try {
        const result = await prisma.$queryRawUnsafe<any[]>(
            `SELECT pg_database_size(current_database()) / (1024 * 1024) as size_mb`
        )
        dbSizeMb = Number(result[0]?.size_mb || 0)
    } catch (e) {
        console.warn('Failed to fetch DB size:', e)
    }

    // 3. Data Inventory
    const [totalUsers, totalDocs, totalDivs, totalContents] = await Promise.all([
        prisma.user.count(),
        prisma.document.count(),
        prisma.division.count(),
        prisma.content.count()
    ])

    // 4. AI Usage (Last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const aiStats = await prisma.aIUsageLog.aggregate({
        where: { created_at: { gte: thirtyDaysAgo } },
        _sum: { tokens_used: true },
        _count: { id: true }
    })

    // 5. Engagement (DAU Today)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dauToday = await prisma.session.count({
        where: { expires: { gte: today } }
    })

    // 6. Organization Context (First one for simplicity)
    const org = await prisma.organization.findFirst()
    
    // 7. Recent Errors (Last 24h)
    const errors24h = await prisma.errorLog.aggregate({
        where: { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        _count: { id: true },
    })

    const payload = {
        instance_key: env.INSTANCE_KEY,
        client_name: env.INSTANCE_NAME,
        app_version: '1.2.0',
        system: {
            cpu_percent: Math.round(cpu_percent * 10) / 10,
            memory_percent: Math.round(memory_percent * 10) / 10,
            disk_percent: 0,
            uptime_seconds: Math.round(os.uptime())
        },
        database: {
            status: 'connected',
            size_mb: Math.round(dbSizeMb * 10) / 10,
            connections: 0
        },
        data: {
            total_users: totalUsers,
            total_documents: totalDocs,
            total_divisions: totalDivs,
            total_contents: totalContents
        }
    }

    // DEBUG: Log the payload we are sending
    console.log('[Monitoring] Sending Payload:', JSON.stringify(payload, null, 2))

    return payload as any
}

/**
 * Sends the heartbeat payload to the remote monitoring center.
 */
export async function sendHeartbeat() {
    try {
        const payload = await collectMetrics()
        const response = await fetch(`${env.MONITORING_CENTER_URL}/monitoring/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const errBody = await response.text()
            throw new Error(`Center responded with ${response.status}: ${errBody}`)
        }

        console.log(`[Monitoring] Heartbeat sent successfully at ${new Date().toISOString()}`)
        return { success: true }
    } catch (error) {
        console.error('[Monitoring] Failed to send heartbeat:', error)
        return { success: false, error }
    }
}
