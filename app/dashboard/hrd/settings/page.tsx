'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function RedirectSettingsPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/dashboard/hrd/website')
    }, [router])

    return (
        <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-2xl border-2 border-dashed border-navy-100">
            <Loader2 className="w-10 h-10 text-navy-600 animate-spin mb-4" />
            <p className="text-text-500 font-medium font-display">Redirecting to new settings page...</p>
        </div>
    )
}
