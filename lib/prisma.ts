import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
    try {
        const connectionString = process.env.DATABASE_URL
        const host = connectionString?.split('@')[1]?.split('/')[0] || 'unknown'
        console.log(`[PRISMA] Initializing client for: ${host}`)
        
        const pool = new Pool({ 
            connectionString,
            ssl: {
                rejectUnauthorized: false // Required for many hosted PostgreSQL instances
            },
            max: parseInt(process.env.DB_POOL_MAX || "2"), // Lower max connections for serverless
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        })
        
        // Error handling for the pool
        pool.on('error', (err) => {
            console.error('[PRISMA] Unexpected error on idle client', err)
        })

        const adapter = new PrismaPg(pool)
        const prisma = new PrismaClient({ adapter })
        
        console.log('[PRISMA] Client created successfully')
        return prisma
    } catch (error) {
        console.error('[PRISMA] Fatal error during client initialization:', error)
        throw error
    }
}

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

// Ensure singleton instance
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaGlobal = prisma
}
