import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            env.NEXT_PUBLIC_SUPABASE_URL,
            env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    get: (name: string) => cookieStore.get(name)?.value,
                },
            }
        )

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get user profile with division and role
        const userRecord = await prisma.user.findUnique({
            where: { id: user.id },
            select: { organization_id: true },
        })
        if (!userRecord) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 })
        }

        const userDiv = await prisma.userDivision.findFirst({
            where: { user_id: user.id, is_primary: true },
        })

        const orgId = userRecord.organization_id
        const role = userDiv?.role
        const divisionId = userDiv?.division_id
        const isAdmin = role === 'SUPER_ADMIN' || role === 'MAINTAINER'

        // Base filters
        const orgFilter = { organization_id: orgId }
        const divFilter = !isAdmin && divisionId
            ? { organization_id: orgId, division_id: divisionId }
            : orgFilter

        // Fetch counts in parallel
        const [
            totalDocuments,
            totalContents,
            totalDivisions,
            totalMembers,
            readTrackerStats,
        ] = await Promise.all([
            prisma.document.count({ where: divFilter }),
            prisma.content.count({ where: { ...divFilter, status: 'PUBLISHED' } }),
            isAdmin
                ? prisma.division.count({ where: { organization_id: orgId } })
                : Promise.resolve(0),
            isAdmin
                ? prisma.user.count({ where: { organization_id: orgId, is_active: true } })
                : prisma.userDivision.count({
                    where: { division_id: divisionId || '', user: { is_active: true } },
                }),
            // Reading tracker aggregate: count confirmed reads
            prisma.readTracker.count({
                where: {
                    is_confirmed: true,
                    content: divFilter,
                },
            }),
        ])

        // Total mandatory content for reading rate
        const totalMandatory = await prisma.content.count({
            where: {
                ...divFilter,
                is_mandatory_read: true,
                status: 'PUBLISHED',
            },
        })

        // Total expected reads = mandatory content * members
        const memberCount = isAdmin
            ? await prisma.user.count({ where: { organization_id: orgId, is_active: true } })
            : totalMembers

        const expectedReads = totalMandatory * memberCount
        const readingRate = expectedReads > 0
            ? Math.round((readTrackerStats / expectedReads) * 100)
            : 0

        return NextResponse.json({
            totalDocuments,
            totalContents,
            totalDivisions: isAdmin ? totalDivisions : undefined,
            totalMembers,
            readingTracker: {
                confirmed: readTrackerStats,
                expected: expectedReads,
                rate: readingRate,
            },
            role,
        })
    } catch (err: any) {
        console.error('[Dashboard Stats]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
