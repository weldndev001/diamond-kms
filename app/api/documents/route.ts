import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    const divisionId = searchParams.get('divisionId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sort = searchParams.get('sort') || 'newest'

    if (!orgId) {
        return NextResponse.json({ success: false, error: 'Missing orgId' }, { status: 400 })
    }

    try {
        const documents = await prisma.document.findMany({
            where: {
                organization_id: orgId,
                ...(divisionId ? { division_id: divisionId } : {})
            },
            include: {
                division: { select: { id: true, name: true } },
            },
            orderBy: { created_at: sort === 'oldest' ? 'asc' : 'desc' },
            take: limit,
        })

        return NextResponse.json({ success: true, documents, data: documents })
    } catch (error: any) {
        console.error('[DOCUMENTS API] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
