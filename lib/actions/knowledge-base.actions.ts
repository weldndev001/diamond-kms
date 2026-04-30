'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ContentStatus, Role, Prisma } from '@prisma/client'
import { getSessionUser, isAdmin, isGroupAdmin, isSupervisor } from '@/lib/auth/server-utils'

/**
 * Gets knowledge bases for an organization, filtered by user group and role.
 */
export async function getKnowledgeBasesAction(organization_id: string, group_id?: string) {
    try {
        const user = await getSessionUser()
        if (!user) return []

        const where: any = { organization_id }

        // RBAC filtering
        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.MAINTAINER) {
            // Group Admin, Supervisor, and Staff see their group's KBs AND global KBs
            where.OR = [
                { group_id: user.groupId },
                { group_id: null }
            ]
            
            // Staff only sees PUBLISHED KBs
            if (user.role === Role.STAFF) {
                where.status = ContentStatus.PUBLISHED
            }
        } else if (group_id) {
            // Super Admin can filter by group
            where.group_id = group_id === 'global' ? null : group_id
        }

        const kbs = await prisma.knowledgeBase.findMany({
            where,
            include: {
                documents: true,
                group: { select: { name: true } },
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
                        select: { file_name: true, group: { select: { name: true } } }
                    })
                    return {
                        id: docSource.source_id,
                        title: d?.file_name || 'Unknown Document',
                        type: 'document' as const,
                        groupName: d?.group?.name
                    }
                } else {
                    const c = await prisma.content.findUnique({
                        where: { id: docSource.source_id },
                        select: { title: true, group: { select: { name: true } } }
                    })
                    return {
                        id: docSource.source_id,
                        title: c?.title || 'Unknown Content',
                        type: 'content' as const,
                        groupName: c?.group?.name
                    }
                }
            }))

            return {
                id: kb.id,
                name: kb.name,
                description: kb.description || '',
                status: kb.status,
                groupName: kb.group?.name || 'Global',
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
    groupId?: string
) {
    try {
        const user = await getSessionUser()
        if (!user) return { success: false, error: 'User session not found' }

        // Role verification
        if (!await isSupervisor(groupId)) {
            return { success: false, error: 'Unauthorized: Minimal role Supervisor diperlukan' }
        }

        // Supervisor can only create DRAFT
        const finalStatus = (await isGroupAdmin(groupId)) ? ContentStatus.PUBLISHED : ContentStatus.DRAFT

        const newKb = await prisma.knowledgeBase.create({
            data: {
                organization_id,
                group_id: groupId || null,
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

        if (!await isGroupAdmin(kb.group_id || undefined)) {
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

        if (!await isSupervisor(kb.group_id || undefined)) {
            return { success: false, error: 'Unauthorized' }
        }

        await prisma.knowledgeBase.update({
            where: { id: kbId },
            data: { 
                suggested_questions: Prisma.DbNull,
                updated_at: new Date()
            }
        });

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

        if (!await isSupervisor(kb.group_id || undefined)) {
            return { success: false, error: 'Unauthorized' }
        }

        await prisma.knowledgeBase.update({
            where: { id: kbId },
            data: { 
                suggested_questions: Prisma.DbNull,
                updated_at: new Date()
            }
        });

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

        if (!await isGroupAdmin(kb.group_id || undefined)) {
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
/**
 * Gets AI-recommended questions based on KB content (with caching)
 */
export async function getKBRecommendationsAction(kbId: string) {
    try {
        const kb = await prisma.knowledgeBase.findUnique({
            where: { id: kbId },
            include: { documents: true }
        });
        if (!kb) return [];

        // 1. Check cache first
        if (kb.suggested_questions && Array.isArray(kb.suggested_questions) && kb.suggested_questions.length > 0) {
            return kb.suggested_questions as string[];
        }

        // 2. If no cache, generate with AI
        const docIds = kb.documents.filter(d => d.source_type === 'document').map(d => d.source_id);
        const contentIds = kb.documents.filter(d => d.source_type === 'content').map(d => d.source_id);
        
        const [docs, contents] = await Promise.all([
            prisma.document.findMany({
                where: { id: { in: docIds } },
                select: { ai_title: true, ai_summary: true, ai_tags: true, file_name: true }
            }),
            prisma.content.findMany({
                where: { id: { in: contentIds } },
                select: { title: true, category: true }
            })
        ]);

        const context = [
            ...docs.map(d => `${d.ai_title || d.file_name}: ${d.ai_summary || ''} [${d.ai_tags?.join(', ') || ''}]`),
            ...contents.map(c => `${c.title}: ${c.category}`)
        ].join('\n').slice(0, 1500);

        if (!context.trim()) {
            return ["Apa saja dokumen yang ada di sini?", "Bagaimana cara mulai?", "Apa fitur utama sistem ini?"];
        }

        const { getAIServiceForOrg } = await import('@/lib/ai/get-ai-service');
        const ai = await getAIServiceForOrg(kb.organization_id);
        
        const prompt = `Berdasarkan ringkasan isi Knowledge Base berikut, buatkan 4 contoh pertanyaan singkat, spesifik, dan menarik yang mungkin diajukan oleh pengguna dalam Bahasa Indonesia. Berikan hasilnya dalam format JSON array string saja tanpa markdown. 
        Jangan gunakan kata "Apakah", buatlah pertanyaan yang langsung to-the-point dan menggugah rasa ingin tahu.
        ISI KNOWLEDGE BASE:
        ${context}`;

        const response = await ai.generateCompletion(prompt, { jsonMode: true });
        let questions: string[] = [];
        try {
            const cleanResponse = response.replace(/```json|```/g, '').trim();
            questions = JSON.parse(cleanResponse);
        } catch {
            const match = response.match(/\[[\s\S]*\]/);
            if (match) questions = JSON.parse(match[0]);
        }

        const finalQuestions = Array.isArray(questions) ? questions.slice(0, 4) : [];

        // 3. Save to cache in background
        if (finalQuestions.length > 0) {
            prisma.knowledgeBase.update({
                where: { id: kbId },
                data: { suggested_questions: finalQuestions }
            }).catch(e => console.error('Cache save failed', e));
        }

        return finalQuestions;
    } catch (err) {
        console.error('Error generating recommendations', err);
        return [];
    }
}
