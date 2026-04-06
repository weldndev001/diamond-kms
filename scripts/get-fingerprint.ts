import { licenseService } from '../lib/services/license-service'

async function run() {
    console.log('--- Diamond KMS Fingerprinting Utility ---')
    console.log('Generating fingerprint for current system...')
    
    try {
        const fingerprint = licenseService.getFingerprint()
        console.log(`\nHardware Fingerprint: ${fingerprint}`)
        console.log('\nUse this fingerprint to generate/activate your license key.')
        console.log('-------------------------------------------')
    } catch (err) {
        console.error('Error generating fingerprint:', err)
        process.exit(1)
    }
}

run()
