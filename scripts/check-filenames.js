// Script to compare DB and Disk filenames for FAQs
require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    
    try {
        const result = await pool.query('SELECT id, question, image_url FROM faqs')
        const uploadDir = './uploads/faqs'
        
        console.log('--- DIAGNOSTIC CHECK ---')
        
        result.rows.forEach(faq => {
            console.log(`FAQ: ${faq.question}`)
            const url = faq.image_url
            if (!url) {
                console.log('  Status: No image')
                return
            }
            
            console.log(`  Stored URL: ${url}`)
            
            // Extract filename from /api/storage/faqs/FILENAME
            const filename = url.split('/').pop()
            const fullPath = path.join(process.cwd(), uploadDir, filename)
            
            const exists = fs.existsSync(fullPath)
            console.log(`  File exists on disk: ${exists}`)
            if (!exists) {
                console.log(`  Searched for: ${fullPath}`)
                
                // List files to see if something similar exists
                const files = fs.readdirSync(path.join(process.cwd(), uploadDir))
                const match = files.find(f => f.includes(filename.substring(0, 20)))
                if (match) {
                    console.log(`  Suggested match on disk: ${match}`)
                }
            }
            console.log('')
        })
        
    } finally {
        await pool.end()
    }
}

main().catch(console.error)
