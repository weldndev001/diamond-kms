'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getQuizzesAction(orgId: string, divisionId?: string) {
    try {
        const where: any = { organization_id: orgId }
        
        if (divisionId && divisionId !== 'ALL') {
            where.division_id = divisionId
        }

        const quizzes = await prisma.quiz.findMany({
            where,
            select: {
                id: true,
                title: true,
                description: true,
                is_published: true,
                time_limit_minutes: true,
                division_id: true,
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
        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
                questions: { orderBy: { order_index: 'asc' } },
                division: true,
                content: true
            }
        })
        if (!quiz) return { success: false, error: 'Quiz not found' }
        return { success: true, data: quiz }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createQuizAction(data: {
    title: string
    description?: string
    time_limit_minutes?: number
    division_id: string
    content_id?: string
    organization_id: string
    created_by: string
    is_published?: boolean
    questions: Array<{
        question_text: string
        options: string[]
        correct_answer: string
        image?: string | null
    }>
}) {
    try {
        // RBAC: Check role for publication (User model doesn't have role directly)
        const userDivisions = await prisma.userDivision.findMany({
            where: { user_id: data.created_by },
            select: { role: true }
        })
        const canPublish = userDivisions.some(ud => ud.role === 'GROUP_ADMIN' || ud.role === 'SUPER_ADMIN')
        
        const finalIsPublished = canPublish ? (data.is_published || false) : false

        const quiz = await prisma.quiz.create({
            data: {
                title: data.title,
                description: data.description,
                time_limit_minutes: data.time_limit_minutes,
                division_id: data.division_id,
                content_id: data.content_id || undefined,
                organization_id: data.organization_id,
                created_by: data.created_by,
                is_published: finalIsPublished,
                questions: {
                    create: data.questions.map((q, i) => ({
                        question_text: q.question_text,
                        question_type: 'MULTIPLE_CHOICE',
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
    time_limit_minutes?: number
    division_id: string
    content_id?: string
    is_published?: boolean
    questions: Array<{
        id?: string
        question_text: string
        options: string[] | any
        correct_answer: string
        image?: string | null
    }>
    created_by?: string
}) {
    console.log(`[updateQuizFullAction] Updating quiz ${id}, questions count: ${data.questions?.length}`);
    try {
        if (!id) throw new Error("Quiz ID is required");
        if (!data.questions || data.questions.length === 0) {
            throw new Error("Quiz must have at least one question");
        }
        if (data.is_published && data.created_by) {
            const userDivisions = await prisma.userDivision.findMany({
                where: { user_id: data.created_by },
                select: { role: true }
            })
            const canPublish = userDivisions.some(ud => ud.role === 'GROUP_ADMIN' || ud.role === 'SUPER_ADMIN')
            
            if (!canPublish) {
                // If supervisor tries to publish, force to false or throw error
                // Force to false is safer for now to prevent accidental publication
                data.is_published = false
            }
        }
        const result = await prisma.$transaction(async (tx) => {
            const quiz = await tx.quiz.update({
                where: { id },
                data: {
                    title: data.title,
                    description: data.description,
                    time_limit_minutes: data.time_limit_minutes,
                    division_id: data.division_id,
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
                    question_type: 'MULTIPLE_CHOICE',
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
        if (data.is_published && data.created_by) {
            const userDivisions = await prisma.userDivision.findMany({
                where: { user_id: data.created_by },
                select: { role: true }
            })
            const canPublish = userDivisions.some(ud => ud.role === 'GROUP_ADMIN' || ud.role === 'SUPER_ADMIN')
            
            if (!canPublish) {
                throw new Error("Unauthorized to publish. Only Admin can approve quizzes.")
            }
        }
        const updateData: any = {}
        if (data.is_published !== undefined) updateData.is_published = data.is_published
        if (data.notes !== undefined) updateData.notes = data.notes

        const quiz = await prisma.quiz.update({
            where: { id },
            data: updateData
        })
        revalidatePath('/dashboard/quizzes')
        return { success: true, data: quiz }
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
