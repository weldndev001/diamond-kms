import { headers } from 'next/headers'
import { env } from '@/lib/env'

/**
 * Gets the base URL of the application dynamically from request headers.
 * Works in Server Components, API Routes, and Server Actions.
 */
export function getBaseUrl() {
    try {
        const headerList = headers()
        const host = headerList.get('host')
        
        if (host) {
            const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
            return `${protocol}://${host}`
        }
    } catch (e) {
        // Fallback for cases where headers() is not available
        console.warn('[getBaseUrl] Could not detect host from headers, falling back to env.')
    }

    // Fallback to env variable
    return env.NEXT_PUBLIC_APP_URL || 'http://localhost:7000'
}
