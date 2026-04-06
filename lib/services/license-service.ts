import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import os from 'os'

export class LicenseService {
    private static instance: LicenseService
    private licenseFilePath = path.join(process.cwd(), '.license-state')
    private isValid: boolean = false
    private bootCount: number = 0
    private fingerprint: string = ''

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

    public async initialize() {
        try {
            // Load state from file if exists
            if (fs.existsSync(this.licenseFilePath)) {
                const content = fs.readFileSync(this.licenseFilePath, 'utf8').trim()
                const parts = content.split(':')
                
                // Extremely simple validation for now (can be expanded)
                if (parts.length >= 1) {
                    const storedFingerprint = parts[0]
                    if (storedFingerprint === this.fingerprint) {
                        this.isValid = true
                    }
                }
            }

            // Increment boot count (in-memory for now, could be persisted)
            this.bootCount++

            return {
                isValid: this.isValid,
                cloneDetected: false // Placeholder for anti-cloning logic
            }
        } catch (error) {
            console.error('[LicenseService] Initialization error:', error)
            return { isValid: false, cloneDetected: false }
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
}

export const licenseService = LicenseService.getInstance()
