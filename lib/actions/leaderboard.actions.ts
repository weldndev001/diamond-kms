'use server'

import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function getLeaderboardAction(orgId: string, limit: number = 50, divisionId?: string, quizId?: string) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }
        const userRole = (session.user as any).role
        const userDivisionId = (session.user as any).divisionId

        let scoperDivisionId = divisionId
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'MAINTAINER') {
            scoperDivisionId = userDivisionId
        }
        // CASE 1: GLOBAL LEADERBOARD (Total Points from UserPoints table)
        if (!quizId || quizId === 'ALL') {
            const where: any = { organization_id: orgId }
            
            if (scoperDivisionId && scoperDivisionId !== 'ALL') {
                where.user = {
                    user_divisions: {
                        some: { division_id: scoperDivisionId }
                    }
                }
            }

            const data = await prisma.userPoints.findMany({
                where,
                orderBy: { total_points: 'desc' },
                take: limit,
                include: {
                    user: {
                        include: {
                            user_divisions: {
                                include: { division: true }
                            }
                        }
                    }
                }
            })

            const mappedData = data.map(record => {
                const primaryDiv = record.user.user_divisions.find(ud => ud.is_primary) || record.user.user_divisions[0]
                return {
                    id: record.id,
                    userId: record.user_id,
                    name: record.user.full_name,
                    division: primaryDiv?.division.name || 'N/A',
                    jobTitle: record.user.job_title,
                    quizTitle: 'Seluruh Aktivitas (Kuis & Baca)',
                    points: record.total_points,
                    completedAt: record.updated_at
                }
            })

            return { success: true, data: mappedData }
        }

        // CASE 2: SPECIFIC QUIZ LEADERBOARD
        const where: any = {
            quiz: { organization_id: orgId },
            quiz_id: quizId
        }

        if (scoperDivisionId && scoperDivisionId !== 'ALL') {
            where.user = {
                user_divisions: {
                    some: { division_id: scoperDivisionId }
                }
            }
        }

        const data = await prisma.quizResult.findMany({
            where,
            orderBy: { score: 'desc' },
            take: limit,
            include: {
                user: {
                    include: {
                        user_divisions: {
                            include: { division: true }
                        }
                    }
                },
                quiz: {
                    select: { id: true, title: true }
                }
            }
        });

        const mappedData = data.map(record => {
            const primaryDiv = record.user.user_divisions.find(ud => ud.is_primary) || record.user.user_divisions[0];
            return {
                id: record.id,
                userId: record.user_id,
                name: record.user.full_name,
                division: primaryDiv?.division.name || 'N/A',
                jobTitle: record.user.job_title,
                quizTitle: record.quiz.title,
                points: record.score,
                completedAt: record.completed_at
            }
        })

        return { success: true, data: mappedData }
    } catch (error: any) {
        console.error('[getLeaderboardAction] Error:', error)
        return { success: false, error: error.message }
    }
}
