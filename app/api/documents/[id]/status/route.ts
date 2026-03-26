import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const sessionAuth = await getServerSession(authOptions)
    if (!sessionAuth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    try {
        const doc = await prisma.document.findFirst({
            where: { id },
        })

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        return NextResponse.json({
            document: {
                id: doc.id,
                file_name: doc.file_name,
                processing_status: (doc as any).processing_status ?? 'idle',
                processing_log: (doc as any).processing_log ?? null,
                is_processed: doc.is_processed,
                processing_error: doc.processing_error,
                ai_title: doc.ai_title,
                ai_summary: doc.ai_summary,
                ai_tags: doc.ai_tags,
                created_at: doc.created_at,
            }
        })
    } catch (error: any) {
        console.error('[DOC STATUS API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
