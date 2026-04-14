// app/api/activation/status/route.ts
// Returns current license activation status and hardware fingerprint
import { NextResponse } from 'next/server'
import { licenseService } from '@/lib/services/license-service'

export async function GET() {
    try {
        const status = licenseService.getStatus()
        const details = licenseService.getLicenseDetails()

        return NextResponse.json({
            ...status,
            instance_key: process.env.INSTANCE_KEY || 'DKMS-DEFAULT',
            instance_name: process.env.INSTANCE_NAME || 'Diamond KMS',
            center_url: process.env.MONITORING_CENTER_URL || '',
            license_details: details ? {
                plan: details.plan,
                max_users: details.max_users,
                expires_at: details.expires_at,
                issued_at: details.issued_at,
                activated_by: details.activated_by || null,
                activation_mode: details.mode || 'unknown',
            } : null
        })
    } catch (error: any) {
        console.error('[Activation Status] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
