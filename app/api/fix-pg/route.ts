import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        // 1. Enable extension
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`)
        
        // 2. Add column manually
        await prisma.$executeRawUnsafe(`ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector;`)
        await prisma.$executeRawUnsafe(`ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS embedding vector;`)
        
        return NextResponse.json({ success: true, message: 'Extension enabled and columns added' })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
