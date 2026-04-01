import { sendHeartbeat } from '@/lib/services/monitoring-service'
import { env } from '@/lib/env'

let heartbeatInterval: ReturnType<typeof setInterval> | null = null

/**
 * Start the monitoring heartbeat interval.
 * Sends an initial heartbeat, then repeats every `intervalMs` milliseconds.
 * Safe to call multiple times — only one interval will be active.
 * 
 * @param intervalMs - Interval in milliseconds (default: 5 minutes)
 */
export function startMonitoringInterval(intervalMs = 5 * 60 * 1000) {
    if (heartbeatInterval) {
        console.log('[Monitoring] Heartbeat interval already running, skipping.')
        return
    }

    if (!env.MONITORING_CENTER_URL) {
        console.warn('[Monitoring] MONITORING_CENTER_URL not set, monitoring disabled.')
        return
    }

    console.log(`[Monitoring] Starting heartbeat interval (every ${intervalMs / 1000}s) → ${env.MONITORING_CENTER_URL}`)

    // Send first heartbeat after a short delay (let the app fully start)
    setTimeout(async () => {
        console.log('[Monitoring] Sending initial heartbeat...')
        await sendHeartbeat()
    }, 10_000) // 10 seconds after start

    // Then repeat every intervalMs
    heartbeatInterval = setInterval(async () => {
        await sendHeartbeat()
    }, intervalMs)

    // Prevent the interval from keeping the process alive
    if (heartbeatInterval.unref) {
        heartbeatInterval.unref()
    }
}

/**
 * Stop the monitoring heartbeat interval.
 */
export function stopMonitoringInterval() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
        console.log('[Monitoring] Heartbeat interval stopped.')
    }
}
