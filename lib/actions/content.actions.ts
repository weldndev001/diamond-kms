'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ContentStatus, Role } from '@prisma/client'
import { getSessionUser, isAdmin, isGroupAdmin, isSupervisor } from '@/lib/auth/server-utils'

export async function getContentsAction(orgId: string, divisionId?: string) {
    try {
        const user = await getSessionUser()
        if (!user) return { success: false, error: 'User session not found' }

        const where: any = { organization_id: orgId }
        
        // RBAC filtering
        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.MAINTAINER) {
            where.division_id = user.divisionId
            
            // Staff only see PUBLISHED
            if (user.role === Role.STAFF) {
                where.status = ContentStatus.PUBLISHED
            }
        } else if (divisionId) {
            if (divisionId === 'global') {
                where.division_id = null
            } else {
                where.division_id = divisionId
            }
        }

        const contents = await prisma.content.findMany({
            where,
            include: { division: true },
            orderBy: { created_at: 'desc' },
        })

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
        if (!await isSupervisor(data.divisionId)) {
            return { success: false, error: "Unauthorized: Minimal role Supervisor diperlukan" }
        }

        // Supervisor can only create DRAFT
        const finalStatus = (await isGroupAdmin(data.divisionId)) ? ContentStatus.PUBLISHED : ContentStatus.DRAFT

        const content = await prisma.content.create({
            data: {
                title: data.title,
                body: data.body,
                category: data.category || 'General',
                author_id: data.authorId,
                status: finalStatus,
                is_mandatory_read: data.isMandatory || false,
                image_url: data.imageUrl || null,
                published_at: finalStatus === ContentStatus.PUBLISHED ? new Date() : null,
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
        const content = await prisma.content.findUnique({ where: { id } })
        if (!content) return { success: false, error: 'Konten tidak ditemukan' }

        if (!await isGroupAdmin(content.division_id || undefined)) {
            return { success: false, error: "Unauthorized: Hanya Group Admin atau Super Admin yang dapat mempublikasikan konten" }
        }

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
        const content = await prisma.content.findUnique({ where: { id } })
        if (!content) return { success: false, error: 'Konten tidak ditemukan' }

        if (!await isGroupAdmin(content.division_id || undefined)) {
            return { success: false, error: "Unauthorized: Hanya Group Admin atau Super Admin yang dapat menghapus konten" }
        }

        await prisma.content.delete({ where: { id } })
        revalidatePath('/dashboard/contents')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateContentAction(id: string, data: {
    title?: string
    body?: string
    category?: string
    divisionId?: string
    isMandatory?: boolean
    imageUrl?: string
}) {
    try {
        const contentOrig = await prisma.content.findUnique({ where: { id } })
        if (!contentOrig) return { success: false, error: 'Konten tidak ditemukan' }

        if (!await isSupervisor(contentOrig.division_id || undefined)) {
            return { success: false, error: "Unauthorized" }
        }

        const updateData: any = {
            title: data.title,
            body: data.body,
            category: data.category,
            is_mandatory_read: data.isMandatory,
            image_url: data.imageUrl,
            updated_at: new Date(),
        }

        if (data.divisionId) {
            if (data.divisionId === 'global') {
                updateData.division_id = null
            } else {
                updateData.division_id = data.divisionId
            }
        }

        const content = await prisma.content.update({
            where: { id },
            data: updateData
        })

        revalidatePath('/dashboard/content')
        revalidatePath(`/dashboard/knowledge-base/${id}`)
        return { success: true, data: content }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
