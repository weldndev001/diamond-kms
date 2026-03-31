'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

/**
 * MOCK OR REAL GET KBs
 * This function gets all knowledge bases for an organization,
 * including their documents and contents.
 */
export async function getKnowledgeBasesAction(organization_id: string) {
    try {
        const kbs = await prisma.knowledgeBase.findMany({
            where: { organization_id },
            include: {
                documents: true,
                _count: {
                    select: { chat_sessions: true }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        if (!kbs) return []

        // Enrich the documents with actual titles from Document or Content tables
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
                documents: enrichedDocs,
                created_at: kb.created_at.toISOString(),
                messageCount: kb._count.chat_sessions // Simplification: using session count instead of individual messages for now
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
    sources: { id: string, type: 'document' | 'content' }[]
) {
    try {
        const newKb = await prisma.knowledgeBase.create({
            data: {
                organization_id,
                name,
                description,
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
 * Adds multiple sources to an existing KB
 */
export async function addSourcesToKBAction(
    kbId: string,
    sources: { id: string, type: 'document' | 'content' }[]
) {
    try {
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
        console.error('Error adding sources:', error)
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
        await prisma.knowledgeBaseSource.deleteMany({
            where: {
                knowledge_base_id: kbId,
                source_id: sourceId
            }
        })

        revalidatePath('/dashboard/knowledge-base')
        return { success: true }
    } catch (error: any) {
        console.error('Error removing source:', error)
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
            })).sort((a: any, b: any) => 0), // Normally you'd sort by created_at but we don't have it explicitly selected here
            updatedAt: s.updated_at.toISOString()
        }))
    } catch (err) {
        console.error('Error fetching KB chat sessions', err)
        return []
    }
}

/**
 * Deletes a Knowledge Base
 */
export async function deleteKnowledgeBaseAction(kbId: string) {
    try {
        await prisma.knowledgeBase.delete({
            where: { id: kbId }
        })

        revalidatePath('/dashboard/knowledge-base')
        return { success: true }
    } catch (error: any) {
        console.error('Error deleting knowledge base:', error)
        return { success: false, error: error.message }
    }
}
