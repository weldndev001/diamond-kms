/**
 * Next.js Instrumentation Hook
 * Trigger deploy: 2026-04-06 17:47
 * 
 * Called once when the server starts.
 * Used to initialize monitoring heartbeat interval.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // Only run in the Node.js runtime (not Edge or Browser)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            console.log('[Instrumentation] Importing monitoring-init...')
            const { startMonitoringInterval } = await import('@/lib/services/monitoring-init')
            
            console.log('[Instrumentation] Importing license-service...')
            const { licenseService } = await import('@/lib/services/license-service')

            // 🛡️ Initialize license & anti-cloning protection
            console.log('[Instrumentation] Initializing services...')
            const licenseResult = await licenseService.initialize()
            
            if (!licenseResult.isValid) {
                console.warn('⚠️ [Shield] Application running with invalid or missing license')
            }
            if (licenseResult.cloneDetected) {
                console.error('🚨 [Shield] CLONE DETECTED: Hardware ID mismatch!')
            }
            
            // Start heartbeat every 5 minutes
            startMonitoringInterval(5 * 60 * 1000)
            
            console.log('[Instrumentation] Monitoring heartbeat initialized')
        } catch (error) {
            console.error('❌ [Instrumentation] Critical error during registration:', error)
        }
    }
}
