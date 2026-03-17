'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ContentStatus } from '@prisma/client'

export async function getContentsAction(orgId: string, divisionId?: string) {
    try {
        const where: any = { organization_id: orgId }
        if (divisionId === 'global') {
            where.division_id = null
        } else if (divisionId) {
            where.division_id = divisionId
        }

        const contents = await prisma.content.findMany({
            where,
            include: { division: true },
            orderBy: { created_at: 'desc' },
        })

        // Fetch user data manually since there is no prisma relation for author_id
        const userIds = contents.map(c => c.author_id)
        const users = await prisma.user.findMany({ where: { id: { in: userIds } } })
        const userMap = users.reduce((acc, user) => ({ ...acc, [user.id]: user.full_name }), {} as Record<string, string>)

        const data = contents.map(c => ({
            ...c,
            author_name: userMap[c.author_id] || 'Unknown Author'
        }))

        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getContentByIdAction(id: string) {
    try {
        const content = await prisma.content.findUnique({
            where: { id },
            include: { division: true }
        })

        if (!content) return { success: false, error: 'Content not found' }

        const author = await prisma.user.findUnique({ where: { id: content.author_id } })

        return { success: true, data: { ...content, author_name: author?.full_name || 'Unknown Author' } }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createContentAction(data: {
    title: string
    body: string
    category: string
    divisionId: string
    orgId: string
    authorId: string
    isMandatory?: boolean
    imageUrl?: string
}) {
    try {
        const content = await prisma.content.create({
            data: {
                title: data.title,
                body: data.body,
                category: data.category || 'General',
                author_id: data.authorId,
                status: ContentStatus.DRAFT,
                is_mandatory_read: data.isMandatory || false,
                image_url: data.imageUrl || null,
                organization: {
                    connect: { id: data.orgId }
                },
                ...(data.divisionId !== 'global' ? {
                    division: {
                        connect: { id: data.divisionId }
                    }
                } : {})
            }
        })
        revalidatePath('/dashboard/contents')
        return { success: true, data: content }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function publishContentAction(id: string) {
    try {
        await prisma.content.update({
            where: { id },
            data: { status: ContentStatus.PUBLISHED, published_at: new Date() }
        })

        // Trigger background AI processing for GraphRAG
        const { env } = await import('@/lib/env')
        const { headers } = await import('next/headers')
        const headerList = headers()
        const host = headerList.get('host') || 'localhost:7000'
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const baseUrl = env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`
        fetch(`${baseUrl}/api/ai/process-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': env.CRON_SECRET,
            },
            body: JSON.stringify({ contentId: id }),
        }).catch(err => console.error('Failed to trigger AI process-content:', err))

        revalidatePath('/dashboard/contents')
        revalidatePath(`/dashboard/contents/${id}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteContentAction(id: string) {
    try {
        await prisma.content.delete({ where: { id } })
        revalidatePath('/dashboard/contents')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
