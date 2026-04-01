/**
 * Next.js Instrumentation Hook
 * Called once when the server starts.
 * Used to initialize monitoring heartbeat interval.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // Only run in the Node.js runtime (not Edge or Browser)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startMonitoringInterval } = await import('@/lib/services/monitoring-init')
        
        // Start heartbeat every 5 minutes
        startMonitoringInterval(5 * 60 * 1000)
        
        console.log('[Instrumentation] Monitoring heartbeat initialized')
    }
}
