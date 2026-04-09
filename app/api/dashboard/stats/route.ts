import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (user as any).id

        // Get user profile with division and role
        const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { organization_id: true },
        })
        if (!userRecord) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 })
        }

        const userDiv = await prisma.userDivision.findFirst({
            where: { user_id: userId, is_primary: true },
        })

        const orgId = userRecord.organization_id
        const role = userDiv?.role
        const divisionId = userDiv?.division_id
        
        // Define Permission Roles based on user request
        const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'MAINTAINER'
        const isGroupAdmin = role === 'GROUP_ADMIN'
        const isSupervisor = role === 'SUPERVISOR'
        const isStaff = role === 'STAFF'

        // Base filters for Document & Content (Group scoping)
        const divFilter = !isSuperAdmin && divisionId
            ? { organization_id: orgId, division_id: divisionId }
            : { organization_id: orgId }

        // Fetch counts in parallel
        const [
            totalDocuments,
            totalContents,
            totalDivisions,
            totalMembers,
        ] = await Promise.all([
            // 📝 DOCUMENT: Super Admin see all, others see group
            prisma.document.count({ where: divFilter }),
            
            // 📝 CONTENT: Super Admin see all, others see group
            prisma.content.count({ where: { ...divFilter, status: 'PUBLISHED' } }),
            
            // 🏢 GROUP: Super Admin only
            isSuperAdmin
                ? prisma.division.count({ where: { organization_id: orgId } })
                : Promise.resolve(0),
            
            // 👥 MEMBER: Super Admin (All), Group Admin (Group Only), Others No Read
            (isSuperAdmin || isGroupAdmin)
                ? (isSuperAdmin 
                    ? prisma.user.count({ where: { organization_id: orgId, is_active: true } })
                    : prisma.userDivision.count({ where: { division_id: divisionId || '', user: { is_active: true } } }))
                : Promise.resolve(0),
        ])

        // 📈 READING TRACKER: Based on Quiz Completion
        // We calculate aggregate completion rate: (Total unique completions across active quizzes) / (Total expected completions)
        
        // 1. Get relevant quizzes
        const quizWhere: any = { organization_id: orgId, is_published: true }
        if (!isSuperAdmin && divisionId) {
            quizWhere.division_id = divisionId
        }
        
        const activeQuizzes = await prisma.quiz.findMany({
            where: quizWhere,
            select: { id: true }
        })
        
        // 2. Total members to track
        const targetMemberCount = isSuperAdmin
            ? await prisma.user.count({ where: { organization_id: orgId, is_active: true } })
            : (divisionId ? await prisma.userDivision.count({ where: { division_id: divisionId, user: { is_active: true } } }) : 0)

        // 3. Count unique completions per quiz
        const completionsMap = await Promise.all(activeQuizzes.map(async (q) => {
            return prisma.quizResult.groupBy({
                by: ['user_id'],
                where: { quiz_id: q.id }
            }).then(res => res.length)
        }))
        
        const totalCompletions = completionsMap.reduce((acc, curr) => acc + curr, 0)
        const totalExpected = activeQuizzes.length * targetMemberCount
        
        const readingRate = totalExpected > 0
            ? Math.round((totalCompletions / totalExpected) * 100)
            : 0

        return NextResponse.json({
            totalDocuments,
            totalContents,
            totalDivisions: isSuperAdmin ? totalDivisions : undefined,
            totalMembers: (isSuperAdmin || isGroupAdmin) ? totalMembers : undefined,
            readingTracker: {
                confirmed: totalCompletions,
                expected: totalExpected,
                rate: readingRate,
            },
            role,
        })
    } catch (err: any) {
        console.error('[Dashboard Stats]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
