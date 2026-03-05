'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Maintenance page accessible at /dashboard/maintenance — separate from HRD menu
// Only MAINTAINER role can access this, redirects to the actual maintenance page  
export default function MaintenanceSeparatePage() {
    const { role, isLoading } = useCurrentUser()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading) {
            if (role === 'MAINTAINER' || role === 'SUPER_ADMIN') {
                router.replace('/dashboard/hrd/maintenance')
            } else {
                router.replace('/dashboard')
            }
        }
    }, [role, isLoading, router])

    return (
        <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        </div>
    )
}
