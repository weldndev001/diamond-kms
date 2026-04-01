import { NextRequest, NextResponse } from 'next/server'
import { sendHeartbeat } from '@/lib/services/monitoring-service'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Cron endpoint to trigger the system heartbeat.
 * Can be called by Vercel Cron or a custom scheduler.
 */
export async function GET(req: NextRequest) {
    try {
        // Optional: Simple secret check from query or headers
        const authHeader = req.headers.get('Authorization')
        const searchParams = req.nextUrl.searchParams
        const secret = searchParams.get('secret')

        if (env.CRON_SECRET && secret !== env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const result = await sendHeartbeat()

        if (!result.success) {
            return NextResponse.json({ 
                status: 'error', 
                message: result.error instanceof Error ? result.error.message : 'Unknown error'
            }, { status: 500 })
        }

        return NextResponse.json({ 
            status: 'success', 
            message: 'Heartbeat triggered successfully',
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        console.error('[Heartbeat API Error]', error)
        return NextResponse.json({ 
            status: 'error', 
            message: error.message 
        }, { status: 500 })
    }
}
