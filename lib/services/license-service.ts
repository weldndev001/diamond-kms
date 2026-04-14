import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import os from 'os'

export interface LicenseDetails {
    instance_key: string
    fingerprint: string
    plan: string
    max_users: number
    expires_at: string
    issued_at: string
    activated_by?: string
    mode?: string
}

export class LicenseService {
    private static instance: LicenseService
    private licenseFilePath = path.join(process.cwd(), '.license-state')
    private envFilePath = path.join(process.cwd(), '.env')
    private isValid: boolean = false
    private bootCount: number = 0
    private fingerprint: string = ''
    private licenseDetails: LicenseDetails | null = null
    private expiryWarningDays: number = 30

    private constructor() {
        this.fingerprint = this.generateFingerprint()
    }

    public static getInstance(): LicenseService {
        if (!LicenseService.instance) {
            LicenseService.instance = new LicenseService()
        }
        return LicenseService.instance
    }

    private generateFingerprint(): string {
        const platform = os.platform()
        const release = os.release()
        const arch = os.arch()
        const hostname = os.hostname()
        const cpus = os.cpus().length
        const totalMem = os.totalmem()

        // Combine system info into a unique string
        const data = `${platform}-${release}-${arch}-${hostname}-${cpus}-${totalMem}`
        return crypto.createHash('md5').update(data).digest('hex')
    }

    /**
     * Decode and validate a Base64 license key.
     * Returns the decoded license details if valid, null otherwise.
     */
    private decodeLicenseKey(licenseKey: string): LicenseDetails | null {
        try {
            const decoded = Buffer.from(licenseKey, 'base64').toString('utf-8')
            const payload: LicenseDetails = JSON.parse(decoded)

            // Validate required fields
            if (!payload.fingerprint || !payload.expires_at || !payload.plan) {
                console.warn('[LicenseService] License key missing required fields')
                return null
            }

            return payload
        } catch (error) {
            console.error('[LicenseService] Failed to decode license key:', error)
            return null
        }
    }

    /**
     * Initialize the license service — called once at server boot.
     */
    public async initialize() {
        try {
            this.bootCount++

            // Try to load license key from env
            const envLicenseKey = process.env.LICENSE_KEY || ''

            if (envLicenseKey) {
                const details = this.decodeLicenseKey(envLicenseKey)
                if (details) {
                    // Validate fingerprint match
                    if (details.fingerprint !== this.fingerprint) {
                        console.error('🚨 [Shield] CLONE DETECTED: Hardware fingerprint mismatch!')
                        console.error(`   Expected: ${details.fingerprint}`)
                        console.error(`   Got:      ${this.fingerprint}`)
                        return { isValid: false, cloneDetected: true }
                    }

                    // Validate expiry
                    const expiresAt = new Date(details.expires_at)
                    const now = new Date()

                    if (expiresAt <= now) {
                        console.warn('⚠️ [Shield] License EXPIRED at', details.expires_at)
                        this.licenseDetails = details
                        this.isValid = false
                        return { isValid: false, cloneDetected: false, expired: true }
                    }

                    // Check if expiring soon (warning)
                    const daysLeft = Math.floor((expiresAt.getTime() - now.getTime()) / 86400000)
                    if (daysLeft <= this.expiryWarningDays) {
                        console.warn(`⚠️ [Shield] License expiring in ${daysLeft} days!`)
                    }

                    this.licenseDetails = details
                    this.isValid = true

                    // Update .license-state file for consistency
                    this.saveLicenseState(envLicenseKey)

                    console.log(`✅ [Shield] License valid. Plan: ${details.plan}, Expires: ${details.expires_at}`)
                    return { isValid: true, cloneDetected: false }
                }
            }

            // Fallback: try the old .license-state file 
            if (fs.existsSync(this.licenseFilePath)) {
                const content = fs.readFileSync(this.licenseFilePath, 'utf8').trim()
                // Try to decode as base64 license key first
                const details = this.decodeLicenseKey(content)
                if (details && details.fingerprint === this.fingerprint) {
                    const expiresAt = new Date(details.expires_at)
                    if (expiresAt > new Date()) {
                        this.licenseDetails = details
                        this.isValid = true
                        return { isValid: true, cloneDetected: false }
                    }
                }
                
                // Legacy: old format with fingerprint:data
                const parts = content.split(':')
                if (parts.length >= 1) {
                    const storedFingerprint = parts[0]
                    if (storedFingerprint === this.fingerprint) {
                        this.isValid = true
                    }
                }
            }

            if (!this.isValid) {
                console.warn('⚠️ [Shield] Application running with invalid or missing license')
            }

            return {
                isValid: this.isValid,
                cloneDetected: false
            }
        } catch (error) {
            console.error('[LicenseService] Initialization error:', error)
            return { isValid: false, cloneDetected: false }
        }
    }

    /**
     * Activate a license key — validates, saves to .env and .license-state.
     * Returns { success, error?, details? }
     */
    public activateLicenseKey(licenseKey: string): { success: boolean; error?: string; details?: LicenseDetails } {
        try {
            const details = this.decodeLicenseKey(licenseKey)
            if (!details) {
                return { success: false, error: 'Invalid license key format. Cannot decode.' }
            }

            // Validate fingerprint
            if (details.fingerprint !== this.fingerprint) {
                return {
                    success: false,
                    error: `Fingerprint mismatch. This license was issued for a different machine. Expected: ${details.fingerprint}, Got: ${this.fingerprint}`
                }
            }

            // Validate expiry
            const expiresAt = new Date(details.expires_at)
            if (expiresAt <= new Date()) {
                return { success: false, error: 'License key has already expired.' }
            }

            // Save to .env file
            this.updateEnvFile('LICENSE_KEY', licenseKey)

            // Save to .license-state
            this.saveLicenseState(licenseKey)

            // Update in-memory state
            this.licenseDetails = details
            this.isValid = true

            console.log(`✅ [Shield] License activated! Plan: ${details.plan}, Expires: ${details.expires_at}`)
            return { success: true, details }

        } catch (error: any) {
            console.error('[LicenseService] Activation error:', error)
            return { success: false, error: error.message || 'Unknown activation error' }
        }
    }

    /**
     * Deactivate the current license.
     */
    public deactivateLicense(): void {
        try {
            this.updateEnvFile('LICENSE_KEY', '')
            if (fs.existsSync(this.licenseFilePath)) {
                fs.unlinkSync(this.licenseFilePath)
            }
            this.isValid = false
            this.licenseDetails = null
            console.log('🔒 [Shield] License deactivated')
        } catch (error) {
            console.error('[LicenseService] Deactivation error:', error)
        }
    }

    /**
     * Get current license details (decoded).
     */
    public getLicenseDetails(): LicenseDetails | null {
        return this.licenseDetails
    }

    /**
     * Get license status summary for API responses.
     */
    public getStatus(): {
        is_valid: boolean
        fingerprint: string
        plan: string | null
        expires_at: string | null
        days_remaining: number
        max_users: number
        mode: string
        is_expired: boolean
        is_expiring_soon: boolean
    } {
        const details = this.licenseDetails
        const now = new Date()
        const expiresAt = details?.expires_at ? new Date(details.expires_at) : null
        const daysRemaining = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 86400000)) : 0
        const isExpired = expiresAt ? expiresAt <= now : false
        const isExpiringSoon = !isExpired && daysRemaining <= this.expiryWarningDays

        return {
            is_valid: this.isValid,
            fingerprint: this.fingerprint,
            plan: details?.plan || null,
            expires_at: details?.expires_at || null,
            days_remaining: daysRemaining,
            max_users: details?.max_users || 0,
            mode: process.env.ACTIVATION_MODE || 'offline',
            is_expired: isExpired,
            is_expiring_soon: isExpiringSoon,
        }
    }

    public isLicenseValid(): boolean {
        return this.isValid
    }

    public getFingerprint(): string {
        return this.fingerprint
    }

    public getBootCount(): number {
        return this.bootCount
    }

    // ─── Private Helpers ───────────────────────────

    private saveLicenseState(licenseKey: string): void {
        try {
            fs.writeFileSync(this.licenseFilePath, licenseKey, 'utf8')
        } catch (error) {
            console.error('[LicenseService] Failed to save license state:', error)
        }
    }

    private updateEnvFile(key: string, value: string): void {
        try {
            if (!fs.existsSync(this.envFilePath)) return

            let content = fs.readFileSync(this.envFilePath, 'utf8')
            const regex = new RegExp(`^${key}=.*$`, 'm')

            if (regex.test(content)) {
                content = content.replace(regex, `${key}="${value}"`)
            } else {
                content += `\n${key}="${value}"\n`
            }

            fs.writeFileSync(this.envFilePath, content, 'utf8')
        } catch (error) {
            console.error(`[LicenseService] Failed to update .env for ${key}:`, error)
        }
    }
}

export const licenseService = LicenseService.getInstance()
