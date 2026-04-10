'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@prisma/client'

export async function getQuizzesAction(orgId: string, groupId?: string) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }
        
        const userRole = (session.user as any).role
        const userGroupId = (session.user as any).groupId

        const where: any = { organization_id: orgId }
        
        // RBAC Scoping
        if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MAINTAINER) {
            where.group_id = userGroupId
        } else if (groupId && groupId !== 'ALL') {
            where.group_id = groupId
        }

        const quizzes = await prisma.quiz.findMany({
            where,
            select: {
                id: true,
                title: true,
                description: true,
                is_published: true,
                time_limit_minutes: true,
                header_image: true,
                group_id: true,
                created_by: true,
                notes: true,
                _count: {
                    select: { questions: true }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        return { success: true, data: quizzes }
    } catch (error: any) {
        console.error('[getQuizzesAction] Error:', error)
        return { success: false, error: error.message }
    }
}

export async function getQuizByIdAction(id: string) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }
        
        const userRole = (session.user as any).role
        const userGroupId = (session.user as any).groupId

        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
                questions: { orderBy: { order_index: 'asc' } },
                group: true,
                content: true
            }
        })
        if (!quiz) return { success: false, error: 'Quiz not found' }

        // RBAC Scoping
        if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MAINTAINER) {
            if (quiz.group_id !== userGroupId) {
                return { success: false, error: 'Anda tidak memiliki akses ke kuis ini.' }
            }
        }

        return { success: true, data: quiz }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createQuizAction(data: {
    title: string
    description?: string
    header_image?: string
    time_limit_minutes?: number
    group_id: string
    content_id?: string
    organization_id: string
    created_by: string
    is_published?: boolean
    questions: Array<{
        question_text: string
        question_type?: string
        options: string[]
        correct_answer: string
        image?: string | null
    }>
}) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }
        
        const userRole = (session.user as any).role
        const userGroupId = (session.user as any).groupId

        // RBAC: Force group if not Super Admin
        let finalGroupId = data.group_id
        if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MAINTAINER) {
            finalGroupId = userGroupId
        }

        const canPublish = userRole === Role.GROUP_ADMIN || userRole === Role.SUPER_ADMIN || userRole === Role.MAINTAINER
        
        const finalIsPublished = canPublish ? (data.is_published || false) : false

        const quiz = await prisma.quiz.create({
            data: {
                title: data.title,
                description: data.description,
                header_image: data.header_image,
                time_limit_minutes: data.time_limit_minutes,
                group_id: finalGroupId,
                content_id: data.content_id || undefined,
                organization_id: data.organization_id,
                created_by: data.created_by,
                is_published: finalIsPublished,
                questions: {
                    create: data.questions.map((q, i) => ({
                        question_text: q.question_text,
                        question_type: q.question_type || 'MULTIPLE_CHOICE',
                        options: q.options || [],
                        correct_answer: q.correct_answer,
                        image: q.image || undefined,
                        order_index: i
                    }))
                }
            }
        })
        revalidatePath('/dashboard/quizzes')
        return { success: true, data: quiz }
    } catch (error: any) {
        console.error("Quiz creation error:", error)
        return { success: false, error: error.message }
    }
}

export async function submitQuizResultAction(data: {
    quizId: string
    userId: string
    score: number
    answers: Record<string, string>
}) {
    try {
        const result = await prisma.quizResult.create({
            data: {
                quiz_id: data.quizId,
                user_id: data.userId,
                score: data.score,
                answers: data.answers
            }
        })

        // Award points if the user scored well (e.g., > 60%)
        if (data.score > 60) {
            const userPoints = await prisma.userPoints.findUnique({ where: { user_id: data.userId } })

            // Assume 10 points per 10% score
            const pointsEarned = Math.floor(data.score / 10) * 10

            if (userPoints) {
                await prisma.userPoints.update({
                    where: { id: userPoints.id },
                    data: { total_points: userPoints.total_points + pointsEarned }
                })
            } else {
                // If the UserPoints document doesn't exist, we should ideally fetch the orgId first
                const user = await prisma.user.findUnique({ where: { id: data.userId } })
                if (user) {
                    await prisma.userPoints.create({
                        data: {
                            user_id: user.id,
                            organization_id: user.organization_id,
                            total_points: pointsEarned
                        }
                    })
                }
            }
        }

        revalidatePath(`/dashboard/quizzes/${data.quizId}`)
        return { success: true, data: result }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteQuizAction(id: string) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }
        const userRole = (session.user as any).role
        const userGroupId = (session.user as any).groupId

        const quiz = await prisma.quiz.findUnique({ where: { id } })
        if (!quiz) return { success: false, error: 'Quiz not found' }

        if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MAINTAINER) {
            if (quiz.group_id !== userGroupId) {
                return { success: false, error: 'Anda tidak diizinkan menghapus kuis di grup lain.' }
            }
        }

        await prisma.quiz.delete({ where: { id } })
        revalidatePath('/dashboard/quizzes')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
export async function updateQuizFullAction(id: string, data: {
    title: string
    description?: string
    header_image?: string
    time_limit_minutes?: number
    group_id: string
    content_id?: string
    is_published?: boolean
    questions: Array<{
        id?: string
        question_text: string
        question_type?: string
        options: string[] | any
        correct_answer: string
        image?: string | null
    }>
    created_by?: string
}) {
    console.log(`[updateQuizFullAction] Updating quiz ${id}, questions count: ${data.questions?.length}`);
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }
        const userRole = (session.user as any).role
        const userGroupId = (session.user as any).groupId

        if (!id) throw new Error("Quiz ID is required");
        
        const existingQuiz = await prisma.quiz.findUnique({ where: { id } })
        if (!existingQuiz) throw new Error("Quiz not found")

        // RBAC Scoping
        if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MAINTAINER) {
            if (existingQuiz.group_id !== userGroupId) {
                throw new Error("Anda tidak memiliki akses ke kuis ini.")
            }
        }

        if (!data.questions || data.questions.length === 0) {
            throw new Error("Quiz must have at least one question");
        }

        const canPublish = userRole === Role.GROUP_ADMIN || userRole === Role.SUPER_ADMIN || userRole === Role.MAINTAINER
        
        if (data.is_published && !canPublish) {
            data.is_published = false
        }

        // Force group if not Super Admin
        let finalGroupId = data.group_id
        if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MAINTAINER) {
            finalGroupId = userGroupId
        }
        const result = await prisma.$transaction(async (tx) => {
            const quiz = await tx.quiz.update({
                where: { id },
                data: {
                    title: data.title,
                    description: data.description,
                    header_image: data.header_image,
                    time_limit_minutes: data.time_limit_minutes,
                    group_id: data.group_id,
                    content_id: data.content_id || null,
                    is_published: data.is_published,
                }
            })

            await tx.quizQuestion.deleteMany({
                where: { quiz_id: id }
            })

            await tx.quizQuestion.createMany({
                data: data.questions.map((q, i) => ({
                    quiz_id: id,
                    question_text: q.question_text || "Lihat Gambar di Bawah",
                    question_type: q.question_type || 'MULTIPLE_CHOICE',
                    options: Array.isArray(q.options) ? q.options : [],
                    correct_answer: q.correct_answer || "",
                    image: q.image || null,
                    order_index: i
                }))
            })

            return quiz
        })

        console.log(`[updateQuizFullAction] Successfully updated quiz ${id}`);

        revalidatePath('/dashboard/quizzes')
        revalidatePath(`/dashboard/quizzes/create?edit=${id}`)
        return { success: true, data: result }
    } catch (error: any) {
        console.error("Quiz update error:", error)
        return { success: false, error: error.message }
    }
}

export async function updateQuizAction(id: string, data: {
    is_published?: boolean
    notes?: string
    created_by?: string
}) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }
        const userRole = (session.user as any).role
        const userGroupId = (session.user as any).groupId

        const quiz = await prisma.quiz.findUnique({ where: { id } })
        if (!quiz) throw new Error("Quiz not found")

        if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MAINTAINER) {
            if (quiz.group_id !== userGroupId) {
                throw new Error("Anda tidak memiliki akses.")
            }
        }

        if (data.is_published) {
            const canPublish = userRole === Role.GROUP_ADMIN || userRole === Role.SUPER_ADMIN || userRole === Role.MAINTAINER
            
            if (!canPublish) {
                throw new Error("Unauthorized to publish. Only Admin can approve quizzes.")
            }
        }
        const updateData: any = {}
        if (data.is_published !== undefined) updateData.is_published = data.is_published
        if (data.notes !== undefined) updateData.notes = data.notes

        const updatedQuiz = await prisma.quiz.update({
            where: { id },
            data: updateData
        })
        revalidatePath('/dashboard/quizzes')
        return { success: true, data: updatedQuiz }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateQuizNoteAction(id: string, notes: string) {
    try {
        await prisma.quiz.update({
            where: { id },
            data: { notes }
        })
        revalidatePath('/dashboard/quizzes')
        return { success: true }
    } catch (error: any) {
        console.error("Gagal update catatan:", error)
        return { success: false, error: "Gagal update catatan" }
    }
}
export async function getQuizCompletionStatsAction(orgId: string, groupId?: string) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return { success: false, error: 'Unauthorized' }
        const userRole = (session.user as any).role
        const userGroupId = (session.user as any).groupId

        const membersWhere: any = { organization_id: orgId, is_active: true }
        const quizWhere: any = { organization_id: orgId, is_published: true }
        
        // RBAC Scoping
        if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MAINTAINER) {
            membersWhere.user_groups = { some: { group_id: userGroupId } }
            quizWhere.group_id = userGroupId
        } else if (groupId && groupId !== 'ALL') {
            membersWhere.user_groups = { some: { group_id: groupId } }
            quizWhere.group_id = groupId
        }

        const totalMembers = await prisma.user.count({ where: membersWhere })
        const quizzes = await prisma.quiz.findMany({
            where: quizWhere,
            select: { id: true, title: true, created_at: true }
        })

        const stats = await Promise.all(quizzes.map(async (quiz) => {
            const completedCount = await prisma.quizResult.groupBy({
                by: ['user_id'],
                where: { quiz_id: quiz.id },
            }).then(groups => groups.length)

            return {
                id: quiz.id,
                title: quiz.title,
                category: 'Quiz',
                published_at: quiz.created_at,
                totalTarget: totalMembers,
                readCount: completedCount,
                percent: totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0
            }
        }))

        return { success: true, data: stats }
    } catch (error: any) {
        console.error('[getQuizCompletionStatsAction] Error:', error)
        return { success: false, error: error.message }
    }
}
