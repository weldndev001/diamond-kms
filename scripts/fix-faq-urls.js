// Script to fix FAQ image URLs by making them relative
require('dotenv').config()
const { Pool } = require('pg')

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    
    try {
        console.log('--- FETCHING FAQS ---')
        const result = await pool.query('SELECT id, image_url FROM faqs WHERE image_url IS NOT NULL')
        
        console.log(`Found ${result.rows.length} FAQs with images.`)
        let updateCount = 0

        for (const row of result.rows) {
            const currentUrl = row.image_url
            
            // Check if it's an absolute URL containing /api/storage/
            if (currentUrl.includes('/api/storage/')) {
                // Extract the relative part starting from /api/storage/
                const relativePath = currentUrl.substring(currentUrl.indexOf('/api/storage/'))
                
                if (currentUrl !== relativePath) {
                    console.log(`Updating ID ${row.id}:`)
                    console.log(`  OLD: ${currentUrl}`)
                    console.log(`  NEW: ${relativePath}`)
                    
                    await pool.query('UPDATE faqs SET image_url = $1 WHERE id = $2', [relativePath, row.id])
                    updateCount++
                }
            }
        }
        
        console.log(`--- DONE ---`)
        console.log(`Successfully normalized ${updateCount} URLs to relative paths.`)
        
    } catch (error) {
        console.error('Migration failed:', error)
    } finally {
        await pool.end()
    }
}

main().catch(console.error)
