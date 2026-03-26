import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { path } = await params
    const filePath = path.join('/')

    if (!filePath) {
        return NextResponse.json({ error: 'Missing file path' }, { status: 400 })
    }

    try {
        const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:7000'
        const publicUrl = `${appUrl}/api/storage/documents/${filePath}`

        return NextResponse.json({ url: publicUrl })
    } catch (err: any) {
        console.error('[Storage URL] Error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
