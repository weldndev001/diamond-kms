// app/api/activation/offline/route.ts
// Activate license key manually (offline mode)
import { NextResponse } from 'next/server'
import { licenseService } from '@/lib/services/license-service'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { license_key } = body

        if (!license_key) {
            return NextResponse.json(
                { error: 'license_key is required' },
                { status: 400 }
            )
        }

        const result = licenseService.activateLicenseKey(license_key.trim())

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'License activated successfully!',
            details: result.details
        })
    } catch (error: any) {
        console.error('[Activation Offline] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
