// app/api/activation/online/route.ts
// Proxy endpoint that connects to diamondkms-center for online activation
import { NextResponse } from 'next/server'
import { licenseService } from '@/lib/services/license-service'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { center_url, username, password } = body

        if (!center_url || !username || !password) {
            return NextResponse.json(
                { error: 'center_url, username, and password are required' },
                { status: 400 }
            )
        }

        // Prepare payload for center
        const payload = {
            username,
            password,
            instance_key: process.env.INSTANCE_KEY || 'DKMS-DEFAULT',
            client_name: process.env.INSTANCE_NAME || 'Diamond KMS',
            fingerprint: licenseService.getFingerprint(),
        }

        // Call the center's online activation API
        const cleanUrl = center_url.replace(/\/+$/, '')
        const response = await fetch(`${cleanUrl}/api/activation/online`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000), // 15s timeout
        })

        const responseData = await response.json()

        if (!response.ok) {
            return NextResponse.json(
                { error: responseData.error || `Server responded with ${response.status}` },
                { status: response.status }
            )
        }

        if (!responseData.success || !responseData.license_key) {
            return NextResponse.json(
                { error: 'Server did not return a valid license key' },
                { status: 502 }
            )
        }

        // Activate the received license key locally
        const activationResult = licenseService.activateLicenseKey(responseData.license_key)

        if (!activationResult.success) {
            return NextResponse.json(
                { error: `License received but activation failed: ${activationResult.error}` },
                { status: 500 }
            )
        }

        // Also save the center URL and activation mode to .env
        try {
            const fs = require('fs')
            const path = require('path')
            const envPath = path.join(process.cwd(), '.env')
            let envContent = fs.readFileSync(envPath, 'utf8')

            // Update MONITORING_CENTER_URL
            if (/^MONITORING_CENTER_URL=.*$/m.test(envContent)) {
                envContent = envContent.replace(/^MONITORING_CENTER_URL=.*$/m, `MONITORING_CENTER_URL="${cleanUrl}"`)
            } else {
                envContent += `\nMONITORING_CENTER_URL="${cleanUrl}"\n`
            }

            // Update ACTIVATION_MODE
            if (/^ACTIVATION_MODE=.*$/m.test(envContent)) {
                envContent = envContent.replace(/^ACTIVATION_MODE=.*$/m, `ACTIVATION_MODE="online"`)
            } else {
                envContent += `\nACTIVATION_MODE="online"\n`
            }

            fs.writeFileSync(envPath, envContent, 'utf8')
        } catch (envErr) {
            console.warn('[Activation Online] Failed to update .env with center URL:', envErr)
        }

        return NextResponse.json({
            success: true,
            message: 'License activated successfully via online mode!',
            plan: responseData.plan,
            max_users: responseData.max_users,
            expires_at: responseData.expires_at,
            details: activationResult.details,
        })
    } catch (error: any) {
        console.error('[Activation Online] Error:', error)

        // Better error messages for common scenarios
        if (error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
            return NextResponse.json(
                { error: 'Connection to center timed out. Please check the URL and try again.' },
                { status: 504 }
            )
        }
        if (error.cause?.code === 'ECONNREFUSED') {
            return NextResponse.json(
                { error: 'Cannot connect to center server. Make sure it is running.' },
                { status: 502 }
            )
        }

        return NextResponse.json(
            { error: error.message || 'Unknown error during online activation' },
            { status: 500 }
        )
    }
}
