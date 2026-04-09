'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ContentStatus, Role } from '@prisma/client'
import { getSessionUser, isAdmin, isGroupAdmin, isSupervisor } from '@/lib/auth/server-utils'

/**
 * Gets knowledge bases for an organization, filtered by user division and role.
 */
export async function getKnowledgeBasesAction(organization_id: string, division_id?: string) {
    try {
        const user = await getSessionUser()
        if (!user) return []

        const where: any = { organization_id }

        // RBAC filtering
        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.MAINTAINER) {
            // Group Admin, Supervisor, and Staff see their division's KBs AND global KBs
            where.OR = [
                { division_id: user.divisionId },
                { division_id: null }
            ]
            
            // Staff only sees PUBLISHED KBs
            if (user.role === Role.STAFF) {
                where.status = ContentStatus.PUBLISHED
            }
        } else if (division_id) {
            // Super Admin can filter by division
            where.division_id = division_id === 'global' ? null : division_id
        }

        const kbs = await prisma.knowledgeBase.findMany({
            where,
            include: {
                documents: true,
                division: { select: { name: true } },
                _count: {
                    select: { chat_sessions: true }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        if (!kbs) return []

        const enrichedKBs = await Promise.all(kbs.map(async (kb: any) => {
            const enrichedDocs = await Promise.all(kb.documents.map(async (docSource: any) => {
                if (docSource.source_type === 'document') {
                    const d = await prisma.document.findUnique({
                        where: { id: docSource.source_id },
                        select: { file_name: true, division: { select: { name: true } } }
                    })
                    return {
                        id: docSource.source_id,
                        title: d?.file_name || 'Unknown Document',
                        type: 'document' as const,
                        division: d?.division?.name
                    }
                } else {
                    const c = await prisma.content.findUnique({
                        where: { id: docSource.source_id },
                        select: { title: true, division: { select: { name: true } } }
                    })
                    return {
                        id: docSource.source_id,
                        title: c?.title || 'Unknown Content',
                        type: 'content' as const,
                        division: c?.division?.name
                    }
                }
            }))

            return {
                id: kb.id,
                name: kb.name,
                description: kb.description || '',
                status: kb.status,
                divisionName: kb.division?.name || 'Global',
                documents: enrichedDocs,
                created_at: kb.created_at.toISOString(),
                messageCount: kb._count.chat_sessions
            }
        }))

        return enrichedKBs
    } catch (error) {
        console.error('Error fetching knowledge bases:', error)
        return []
    }
}

/**
 * Creates a new Knowledge Base
 */
export async function createKnowledgeBaseAction(
    organization_id: string,
    name: string,
    description: string,
    sources: { id: string, type: 'document' | 'content' }[],
    divisionId?: string
) {
    try {
        const user = await getSessionUser()
        if (!user) return { success: false, error: 'User session not found' }

        // Role verification
        if (!await isSupervisor(divisionId)) {
            return { success: false, error: 'Unauthorized: Minimal role Supervisor diperlukan' }
        }

        // Supervisor can only create DRAFT
        const finalStatus = (await isGroupAdmin(divisionId)) ? ContentStatus.PUBLISHED : ContentStatus.DRAFT

        const newKb = await prisma.knowledgeBase.create({
            data: {
                organization_id,
                division_id: divisionId || null,
                name,
                description,
                status: finalStatus,
                published_at: finalStatus === ContentStatus.PUBLISHED ? new Date() : null,
                documents: {
                    create: sources.map((s: any) => ({
                        source_id: s.id,
                        source_type: s.type
                    }))
                }
            }
        })

        revalidatePath('/dashboard/knowledge-base')
        return { success: true, kbId: newKb.id }
    } catch (error: any) {
        console.error('Error creating knowledge base:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Publishes a Knowledge Base
 */
export async function publishKnowledgeBaseAction(kbId: string) {
    try {
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } })
        if (!kb) return { success: false, error: 'Knowledge Base tidak ditemukan' }

        if (!await isGroupAdmin(kb.division_id || undefined)) {
            return { success: false, error: 'Unauthorized: Hanya Group Admin atau Super Admin yang dapat mempublikasikan' }
        }

        await prisma.knowledgeBase.update({
            where: { id: kbId },
            data: {
                status: ContentStatus.PUBLISHED,
                published_at: new Date()
            }
        })

        revalidatePath('/dashboard/knowledge-base')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Adds multiple sources to an existing KB
 */
export async function addSourcesToKBAction(
    kbId: string,
    sources: { id: string, type: 'document' | 'content' }[]
) {
    try {
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } })
        if (!kb) return { success: false, error: 'Knowledge Base tidak ditemukan' }

        if (!await isSupervisor(kb.division_id || undefined)) {
            return { success: false, error: 'Unauthorized' }
        }

        await prisma.knowledgeBaseSource.createMany({
            data: sources.map((s: any) => ({
                knowledge_base_id: kbId,
                source_id: s.id,
                source_type: s.type
            })),
            skipDuplicates: true
        })

        revalidatePath('/dashboard/knowledge-base')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Removes a specific source from a KB
 */
export async function removeSourceFromKBAction(
    kbId: string,
    sourceId: string
) {
    try {
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } })
        if (!kb) return { success: false, error: 'Knowledge Base tidak ditemukan' }

        if (!await isSupervisor(kb.division_id || undefined)) {
            return { success: false, error: 'Unauthorized' }
        }

        await prisma.knowledgeBaseSource.deleteMany({
            where: {
                knowledge_base_id: kbId,
                source_id: sourceId
            }
        })

        revalidatePath('/dashboard/knowledge-base')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Deletes a Knowledge Base
 */
export async function deleteKnowledgeBaseAction(kbId: string) {
    try {
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } })
        if (!kb) return { success: false, error: 'Knowledge Base tidak ditemukan' }

        if (!await isGroupAdmin(kb.division_id || undefined)) {
            return { success: false, error: 'Unauthorized: Hanya Group Admin atau Super Admin yang dapat menghapus' }
        }

        await prisma.knowledgeBase.delete({
            where: { id: kbId }
        })

        revalidatePath('/dashboard/knowledge-base')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Gets chat sessions linked to a specific KB
 */
export async function getKBChatSessionsAction(kbId: string) {
    try {
        const sessions = await prisma.chatSession.findMany({
            where: { knowledge_base_id: kbId },
            include: { messages: true },
            orderBy: { updated_at: 'desc' }
        })

        return sessions.map((s: any) => ({
            id: s.id,
            title: s.title,
            messages: s.messages.map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            })).sort((a: any, b: any) => 0), 
            updatedAt: s.updated_at.toISOString()
        }))
    } catch (err) {
        console.error('Error fetching KB chat sessions', err)
        return []
    }
}
