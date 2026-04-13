// Script to check FAQ image URLs in database
require('dotenv').config()
const { Pool } = require('pg')

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    
    try {
        const result = await pool.query('SELECT id, question, image_url FROM faqs')
        
        console.log('=== FAQ IMAGE URLs ===')
        result.rows.forEach(faq => {
            console.log(`ID: ${faq.id}`)
            console.log(`  Question: ${faq.question}`)
            console.log(`  Image URL: ${faq.image_url || '(none)'}`)
            console.log('')
        })
    } finally {
        await pool.end()
    }
}

main().catch(console.error)
