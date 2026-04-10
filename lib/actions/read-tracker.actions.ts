'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function checkAcknowledgeStatusAction(contentId: string, userId: string) {
    try {
        const tracker = await prisma.readTracker.findUnique({
            where: {
                user_id_content_id: {
                    user_id: userId,
                    content_id: contentId
                }
            }
        })
        return { success: true, isAcknowledged: !!tracker?.is_confirmed }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function acknowledgeReadAction(contentId: string, userId: string) {
    try {
        // Double check if already acknowledged
        const existing = await prisma.readTracker.findUnique({
            where: {
                user_id_content_id: {
                    user_id: userId,
                    content_id: contentId
                }
            }
        })

        if (existing?.is_confirmed) {
            return { success: false, error: 'You have already acknowledged this document.' }
        }

        const pointsToAward = 50

        await prisma.$transaction(async (tx) => {
            // 1. Create or update the tracker
            await tx.readTracker.upsert({
                where: {
                    user_id_content_id: {
                        user_id: userId,
                        content_id: contentId
                    }
                },
                update: {
                    is_confirmed: true,
                    confirmed_at: new Date(),
                    points_awarded: pointsToAward
                },
                create: {
                    user_id: userId,
                    content_id: contentId,
                    is_confirmed: true,
                    confirmed_at: new Date(),
                    points_awarded: pointsToAward
                }
            })

            // 2. Award Points
            const user = await tx.user.findUnique({ where: { id: userId } })
            if (user) {
                const userPoints = await tx.userPoints.findUnique({ where: { user_id: userId } })
                if (userPoints) {
                    await tx.userPoints.update({
                        where: { id: userPoints.id },
                        data: { total_points: userPoints.total_points + pointsToAward }
                    })
                } else {
                    await tx.userPoints.create({
                        data: {
                            user_id: userId,
                            organization_id: user.organization_id,
                            total_points: pointsToAward
                        }
                    })
                }
            }
        })

        revalidatePath(`/dashboard/contents/${contentId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getMandatoryReadStatsAction(orgId: string) {
    try {
        const mandatoryContents = await prisma.content.findMany({
            where: { organization_id: orgId, is_mandatory_read: true, status: 'PUBLISHED' },
            include: {
                read_trackers: {
                    include: { user: true }
                },
                organization: {
                    include: { users: true }
                }
            },
            orderBy: { published_at: 'desc' }
        })

        const mappedData = mandatoryContents.map(c => {
            const totalUsers = c.organization.users.length // simplistic, ideally we check by group
            const readCount = c.read_trackers.filter(t => t.is_confirmed).length
            return {
                id: c.id,
                title: c.title,
                category: c.category,
                published_at: c.published_at,
                totalTarget: totalUsers,
                readCount,
                percent: totalUsers > 0 ? Math.round((readCount / totalUsers) * 100) : 0
            }
        })

        return { success: true, data: mappedData }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
