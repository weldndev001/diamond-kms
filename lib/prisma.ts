import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
    const connectionString = process.env.DATABASE_URL
    const isEdge = process.env.DATABASE_URL?.includes('pooler.supabase.com')
    console.log(`[PRISMA] Initializing client for: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`)
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })
    if ((prisma as any)._dMMF?.datamodel?.models) {
        console.log("PRISMA MODELS:", (prisma as any)._dMMF.datamodel.models.map((m: any) => m.name))
    }
    return prisma
}

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') {
    // If we're in dev and the models we expect aren't there, force a refresh
    if (!(prisma as any).knowledgeBase) {
        globalThis.prismaGlobal = prismaClientSingleton()
    } else {
        globalThis.prismaGlobal = prisma
    }
}
