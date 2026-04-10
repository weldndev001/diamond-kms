'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { SuggestionStatus } from '@prisma/client'

export async function createSuggestionAction(contentId: string, userId: string, suggestionText: string) {
    try {
        const suggestion = await prisma.revisionSuggestion.create({
            data: {
                content_id: contentId,
                suggested_by: userId,
                suggestion_text: suggestionText,
                status: SuggestionStatus.PENDING
            }
        })

        revalidatePath(`/dashboard/contents/${contentId}`)
        return { success: true, data: suggestion }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getSuggestionsAction(orgId: string, status?: SuggestionStatus) {
    try {
        const where: any = {
            content: { organization_id: orgId }
        }
        if (status) {
            where.status = status
        }

        const suggestions = await prisma.revisionSuggestion.findMany({
            where,
            include: {
                content: { select: { id: true, title: true, group: { select: { name: true } } } }
            },
            orderBy: { created_at: 'asc' }
        })

        // Fetch user names
        const userIds = suggestions.map(s => s.suggested_by)
        const users = await prisma.user.findMany({ where: { id: { in: userIds } } })
        const userMap = users.reduce((acc, user) => ({ ...acc, [user.id]: user.full_name }), {} as Record<string, string>)

        const data = suggestions.map(s => ({
            ...s,
            suggestor_name: userMap[s.suggested_by] || 'Unknown User'
        }))

        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function reviewSuggestionAction(suggestionId: string, reviewerId: string, status: SuggestionStatus) {
    try {
        const suggestion = await prisma.revisionSuggestion.findUnique({
            where: { id: suggestionId }
        })

        if (!suggestion) return { success: false, error: 'Suggestion not found' }

        await prisma.revisionSuggestion.update({
            where: { id: suggestionId },
            data: {
                status,
                reviewed_by: reviewerId
            }
        })

        // In a real app we might create a Notification for the suggestor here

        revalidatePath('/dashboard/suggestions')
        revalidatePath(`/dashboard/contents/${suggestion.content_id}`)

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
