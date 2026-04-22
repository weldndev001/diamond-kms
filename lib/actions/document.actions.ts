'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Role } from '@prisma/client'
import { getSessionUser, isGroupAdmin, isSupervisor } from '@/lib/auth/server-utils'
import { env } from '@/lib/env'

export async function getDocumentsAction(orgId: string, groupId?: string) {
    try {
        const user = await getSessionUser()
        if (!user) return { success: false, error: 'User session not found' }

        const where: any = { organization_id: orgId }
        
        // RBAC filtering
        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.MAINTAINER) {
            where.group_id = user.groupId
        } else if (groupId) {
            where.group_id = groupId
        }

        const documents = await prisma.document.findMany({
            where,
            include: {
                group: { select: { name: true } }
            },
            orderBy: { created_at: 'desc' }
        })

        const uploaderIds = [...new Set(documents.map(d => d.uploaded_by))]
        const users = await prisma.user.findMany({ where: { id: { in: uploaderIds } } })
        const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u.full_name }), {} as Record<string, string>)

        const data = documents.map(d => ({
            ...d,
            uploader_name: userMap[d.uploaded_by] || 'Unknown'
        }))

        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getDocumentByIdAction(id: string) {
    try {
        const doc = await prisma.document.findUnique({
            where: { id },
            include: {
                group: { select: { name: true } },
                chunks: { orderBy: { chunk_index: 'asc' } }
            }
        })

        if (!doc) return { success: false, error: 'Document not found' }

        const uploader = await prisma.user.findUnique({ where: { id: doc.uploaded_by } })

        return {
            success: true,
            data: {
                ...doc,
                uploader_name: uploader?.full_name || 'Unknown'
            }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createDocumentAction(data: {
    fileName: string
    filePath: string
    fileSize: number
    mimeType: string
    groupId: string
    orgId: string
    userId: string
}) {
    try {
        if (!await isSupervisor(data.groupId)) {
            return { success: false, error: "Unauthorized: Minimal role Supervisor diperlukan untuk mengunggah dokumen" }
        }

        const doc = await prisma.document.create({
            data: {
                file_name: data.fileName,
                file_path: data.filePath,
                file_size: data.fileSize,
                mime_type: data.mimeType,
                group_id: data.groupId,
                organization_id: data.orgId,
                uploaded_by: data.userId,
                is_processed: false
            }
        })

        revalidatePath('/dashboard/documents')
        return { success: true, data: doc }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function processDocumentAction(docId: string, aiData: {
    title: string
    summary: string
    tags: string[]
    chunks: { content: string; tokenCount: number; pageNumber?: number }[]
}) {
    try {
        // Only admins or supervisors can trigger processing
        const doc = await prisma.document.findUnique({ where: { id: docId } })
        if (!doc) return { success: false, error: 'Dokumen tidak ditemukan' }
        
        if (!await isSupervisor(doc.group_id)) {
            return { success: false, error: 'Unauthorized' }
        }

        await prisma.$transaction(async (tx) => {
            await tx.document.update({
                where: { id: docId },
                data: {
                    ai_title: aiData.title,
                    ai_summary: aiData.summary,
                    ai_tags: aiData.tags,
                    is_processed: true
                }
            })

            for (let i = 0; i < aiData.chunks.length; i++) {
                await tx.documentChunk.create({
                    data: {
                        document_id: docId,
                        chunk_index: i,
                        content: aiData.chunks[i].content,
                        token_count: aiData.chunks[i].tokenCount,
                        page_number: aiData.chunks[i].pageNumber
                    }
                })
            }
        })

        revalidatePath('/dashboard/documents')
        revalidatePath(`/dashboard/documents/${docId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteDocumentAction(id: string) {
    try {
        const doc = await prisma.document.findUnique({ where: { id } })
        if (!doc) return { success: false, error: 'Dokumen tidak ditemukan' }

        if (!await isGroupAdmin(doc.group_id)) {
            return { success: false, error: "Unauthorized: Hanya Group Admin atau Super Admin yang dapat menghapus dokumen" }
        }

        await prisma.document.delete({ where: { id } })
        revalidatePath('/dashboard/documents')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function searchDocumentsAction(
    orgId: string,
    query: string,
    options?: {
        userId?: string
        userRole?: string
        groupId?: string
        crossGroupEnabled?: boolean
    }
) {
    try {
        const user = await getSessionUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        // Hybrid search fallback logic
        if (options?.userId && options?.userRole && options?.groupId) {
            try {
                const { hybridSearch } = await import('@/lib/search/hybrid-search')
                const RoleEnum = await import('@prisma/client').then(m => m.Role)
                const results = await hybridSearch({
                    query,
                    orgId,
                    userId: options.userId,
                    userRole: options.userRole as typeof RoleEnum[keyof typeof RoleEnum],
                    groupId: options.groupId,
                    crossGroupEnabled: options.crossGroupEnabled ?? false,
                })
                return { success: true, data: results }
            } catch (hybridErr) {
                console.warn('Hybrid search failed, falling back to basic search:', hybridErr)
            }
        }

        // Fallback: basic SQL search with scoping
        const results = await prisma.document.findMany({
            where: {
                organization_id: orgId,
                is_processed: true,
                ...(user.role !== Role.SUPER_ADMIN && user.role !== Role.MAINTAINER ? {
                    group_id: user.groupId
                } : {}),
                OR: [
                    { ai_title: { contains: query, mode: 'insensitive' } },
                    { ai_summary: { contains: query, mode: 'insensitive' } },
                    { file_name: { contains: query, mode: 'insensitive' } },
                    { chunks: { some: { content: { contains: query, mode: 'insensitive' } } } }
                ]
            },
            include: {
                group: { select: { name: true } },
                chunks: {
                    where: { content: { contains: query, mode: 'insensitive' } },
                    take: 3,
                    orderBy: { chunk_index: 'asc' }
                }
            },
            take: 20
        })

        return { success: true, data: results }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Search failed'
        return { success: false, error: message }
    }
}

export async function reprocessDocumentAction(docId: string) {
    try {
        const user = await getSessionUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const baseUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:7000'
        
        const response = await fetch(`${baseUrl}/api/ai/process-document`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': env.CRON_SECRET || '',
            },
            body: JSON.stringify({ documentId: docId }),
        })

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            return { success: false, error: errData.message || 'Gagal memicu proses ulang' }
        }

        revalidatePath('/dashboard/documents')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
