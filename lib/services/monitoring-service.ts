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
        docs_pending: number
        docs_failed: number
    }
    ai: {
        provider: string
        model: string
        status: string
        avg_response_ms: number
        success_rate: number
        tokens_30d: number
        embedding_total: number
        embedding_done: number
        embedding_failed: number
    }
    engagement: {
        dau_today: number
        chat_sessions_7d: number
        quiz_completions_7d: number
        read_rate: number
        avg_quiz_score: number
        approval_pending: number
    }
    errors: {
        total_24h: number
        error_24h: number
        warn_24h: number
        health_score: number
        latest_errors: any[] | null
    }
    license: {
        plan: string
        expires: string | null
    }
}

/**
 * Collects system, database, and application metrics for the heartbeat.
 */
export async function collectMetrics(): Promise<HeartbeatPayload> {
    // Bypass Webpack static analysis for Node.js built-in module
    const os = eval('require')('os')

    // 1. System Metrics
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const memory_percent = ((totalMem - freeMem) / totalMem) * 100

    const cpus = os.cpus()
    const load = os.loadavg()[0]
    const cpu_percent = Math.min((load / cpus.length) * 100, 100)

    // 2. Database Metrics
    let dbSizeMb = 0
    let dbStatus = 'connected'
    let dbConnections = 0
    try {
        const sizeResult = await prisma.$queryRawUnsafe<any[]>(
            `SELECT pg_database_size(current_database()) / (1024 * 1024) as size_mb`
        )
        dbSizeMb = Number(sizeResult[0]?.size_mb || 0)

        const connResult = await prisma.$queryRawUnsafe<any[]>(
            `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`
        )
        dbConnections = Number(connResult[0]?.count || 0)
    } catch (e) {
        console.warn('[Monitoring] Failed to fetch DB metrics:', e)
        dbStatus = 'error'
    }

    // 3. Data Inventory
    const [totalUsers, totalDocs, totalDivs, totalContents] = await Promise.all([
        prisma.user.count(),
        prisma.document.count(),
        prisma.division.count(),
        prisma.content.count()
    ])

    const [docsPending, docsFailed] = await Promise.all([
        prisma.document.count({ where: { processing_status: 'processing' } }),
        prisma.document.count({ where: { processing_status: 'failed' } })
    ])

    // 4. AI Usage (Last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const aiStats = await prisma.aIUsageLog.aggregate({
        where: { created_at: { gte: thirtyDaysAgo } },
        _sum: { tokens_used: true },
        _count: { id: true }
    })

    // AI embedding stats
    const [embTotal, embDone, embFailed] = await Promise.all([
        prisma.document.count(),
        prisma.document.count({ where: { is_processed: true } }),
        prisma.document.count({ where: { processing_status: 'failed' } })
    ])

    // Determine AI provider from org config
    const org = await prisma.organization.findFirst()
    const aiConfig = (org?.ai_provider_config as any) || {}

    // 5. Engagement
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [dauToday, chatSessions7d, quizCompletions7d, approvalPending] = await Promise.all([
        prisma.session.count({ where: { expires: { gte: today } } }),
        prisma.chatSession.count({ where: { created_at: { gte: sevenDaysAgo } } }),
        prisma.quizResult.count({ where: { completed_at: { gte: sevenDaysAgo } } }),
        prisma.approvalQueue.count({ where: { status: 'PENDING' } })
    ])

    // Read rate: % of mandatory reads confirmed
    let readRate = 0
    try {
        const totalMandatory = await prisma.readTracker.count()
        const confirmedReads = await prisma.readTracker.count({ where: { is_confirmed: true } })
        readRate = totalMandatory > 0 ? Math.round((confirmedReads / totalMandatory) * 100 * 10) / 10 : 0
    } catch { /* ignore */ }

    // Average quiz score
    let avgQuizScore = 0
    try {
        const quizAgg = await prisma.quizResult.aggregate({ _avg: { score: true } })
        avgQuizScore = Math.round((quizAgg._avg.score || 0) * 10) / 10
    } catch { /* ignore */ }

    // 6. Errors (Last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [errorsTotal, errorsError, errorsWarn] = await Promise.all([
        prisma.errorLog.count({ where: { created_at: { gte: twentyFourHoursAgo } } }),
        prisma.errorLog.count({ where: { created_at: { gte: twentyFourHoursAgo }, level: 'ERROR' } }),
        prisma.errorLog.count({ where: { created_at: { gte: twentyFourHoursAgo }, level: 'WARN' } })
    ])

    const latestErrors = await prisma.errorLog.findMany({
        where: { created_at: { gte: twentyFourHoursAgo } },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { level: true, source: true, message: true, created_at: true }
    })

    // Health score: 100 - (errors * 5) - (warnings * 2), min 0
    const healthScore = Math.max(0, 100 - (errorsError * 5) - (errorsWarn * 2))

    // 7. License
    const subscription = await prisma.subscription.findFirst({
        where: { is_active: true },
        orderBy: { expires_at: 'desc' }
    })

    const payload: HeartbeatPayload = {
        instance_key: env.INSTANCE_KEY,
        client_name: env.INSTANCE_NAME,
        app_version: '1.2.0',
        system: {
            cpu_percent: Math.round(cpu_percent * 10) / 10,
            memory_percent: Math.round(memory_percent * 10) / 10,
            disk_percent: 0, // Not easily available cross-platform in Node.js
            uptime_seconds: Math.round(os.uptime())
        },
        database: {
            status: dbStatus,
            size_mb: Math.round(dbSizeMb * 10) / 10,
            connections: dbConnections
        },
        data: {
            total_users: totalUsers,
            total_documents: totalDocs,
            total_divisions: totalDivs,
            total_contents: totalContents,
            docs_pending: docsPending,
            docs_failed: docsFailed
        },
        ai: {
            provider: aiConfig.provider || 'gemini',
            model: aiConfig.model || 'gemini-2.0-flash',
            status: 'active',
            avg_response_ms: 0,
            success_rate: aiStats._count.id > 0 ? 95 : 0,
            tokens_30d: aiStats._sum.tokens_used || 0,
            embedding_total: embTotal,
            embedding_done: embDone,
            embedding_failed: embFailed
        },
        engagement: {
            dau_today: dauToday,
            chat_sessions_7d: chatSessions7d,
            quiz_completions_7d: quizCompletions7d,
            read_rate: readRate,
            avg_quiz_score: avgQuizScore,
            approval_pending: approvalPending
        },
        errors: {
            total_24h: errorsTotal,
            error_24h: errorsError,
            warn_24h: errorsWarn,
            health_score: healthScore,
            latest_errors: latestErrors.length > 0 ? latestErrors : null
        },
        license: {
            plan: subscription?.plan_name || 'basic',
            expires: subscription?.expires_at?.toISOString() || null
        }
    }

    console.log('[Monitoring] Payload collected for', payload.instance_key)
    return payload
}

/**
 * Sends the heartbeat payload to the remote monitoring center.
 */
export async function sendHeartbeat() {
    const centerUrl = env.MONITORING_CENTER_URL
    if (!centerUrl) {
        console.warn('[Monitoring] MONITORING_CENTER_URL not configured, skipping heartbeat')
        return { success: false, error: 'No center URL configured' }
    }

    try {
        const payload = await collectMetrics()
        const response = await fetch(`${centerUrl}/monitoring/heartbeat`, {
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

/**
 * Forward an error log to the monitoring center.
 * Fire-and-forget — never throws.
 */
export async function forwardErrorToCenter(params: {
    level: string
    source: string
    message: string
    stack?: string
    metadata?: any
}) {
    const centerUrl = env.MONITORING_CENTER_URL
    if (!centerUrl) return

    try {
        await fetch(`${centerUrl}/admin/error-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: params.level,
                source: `${env.INSTANCE_KEY} - ${params.source}`,
                message: params.message,
                stack_trace: params.stack,
                metadata: {
                    ...params.metadata,
                    instance_key: env.INSTANCE_KEY,
                    instance_name: env.INSTANCE_NAME
                }
            })
        })
    } catch (e) {
        // Silent fail — don't let monitoring break the app
        console.warn('[Monitoring] Failed to forward error to center:', e)
    }
}
