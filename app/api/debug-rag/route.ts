import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
    try {
        const contentsCount = await prisma.content.count()
        const publishedCount = await prisma.content.count({ where: { status: 'PUBLISHED' } })
        const processedCount = await prisma.content.count({ where: { status: 'PUBLISHED', is_processed: true } })
        
        let embeddedContentChunks = 0
        try {
            const result: any = await prisma.$queryRaw`SELECT count(*) FROM content_chunks WHERE embedding IS NOT NULL`
            embeddedContentChunks = Number(result[0].count)
        } catch (e) {
            console.error(e)
        }
        
        let embeddedDocChunks = 0
        try {
           const result: any = await prisma.$queryRaw`SELECT count(*) FROM document_chunks WHERE embedding IS NOT NULL`
           embeddedDocChunks = Number(result[0].count)
        } catch(e) { console.error(e) }

        return NextResponse.json({
            contentsCount,
            publishedCount,
            processedCount,
            embeddedContentChunks,
            embeddedDocChunks
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
