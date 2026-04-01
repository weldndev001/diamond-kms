import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { forwardErrorToCenter } from '@/lib/services/monitoring-service'

type LogLevel = 'ERROR' | 'WARN' | 'INFO'

interface LogErrorParams {
    level?: LogLevel
    source: string
    message: string
    stack?: string
    url?: string
    method?: string
    userId?: string
    orgId?: string
    metadata?: any
}

/**
 * Safely logs an error/info to the database.
 * Catches any Prisma errors so it doesn't crash the calling function.
 * Also forwards errors to the monitoring center (fire-and-forget).
 */
export async function logErrorToDB({
    level = 'ERROR',
    source,
    message,
    stack,
    url,
    method,
    userId,
    orgId,
    metadata
}: LogErrorParams) {
    try {
        await prisma.errorLog.create({
            data: {
                level,
                source,
                message: String(message),
                stack_trace: stack ? String(stack) : null,
                url,
                method,
                user_id: userId,
                organization_id: orgId,
                metadata: metadata ? (metadata as any) : Prisma.JsonNull
            }
        })

        // Fire-and-forget: forward to monitoring center
        if (level === 'ERROR' || level === 'WARN') {
            forwardErrorToCenter({ level, source, message, stack, metadata }).catch(() => {})
        }
    } catch (e) {
        // Fallback: Just log to server console if the DB log fails
        console.error('[ErrorLogger] Failed to save log to DB:', e)
        console.error('[ErrorLogger] Original error was:', { level, source, message })
    }
}

