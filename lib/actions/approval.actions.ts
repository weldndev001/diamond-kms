'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ContentStatus, ApprovalStatus } from '@prisma/client'

export async function getApprovalQueueAction(orgId: string, groupId?: string) {
    try {
        const where: any = {
            status: ApprovalStatus.PENDING,
            content: { organization_id: orgId }
        }

        // If a group is specified, only show approvals for that group
        if (groupId) {
            where.content.group_id = groupId
        }

        const queues = await prisma.approvalQueue.findMany({
            where,
            include: {
                content: {
                    include: { group: true }
                }
            },
            orderBy: { submitted_at: 'asc' }
        })

        // Fetch authors individually because prisma relations don't exist for submitted_by
        const userIds = queues.map(q => q.submitted_by)
        const users = await prisma.user.findMany({ where: { id: { in: userIds } } })
        const userMap = users.reduce((acc, user) => ({ ...acc, [user.id]: user.full_name }), {} as Record<string, string>)

        const data = queues.map(q => ({
            ...q,
            submitter_name: userMap[q.submitted_by] || 'Unknown User'
        }))

        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function submitForApprovalAction(contentId: string, userId: string) {
    try {
        // Find if already pending
        const existing = await prisma.approvalQueue.findFirst({
            where: { content_id: contentId, status: ApprovalStatus.PENDING }
        })

        if (existing) {
            return { success: false, error: 'Content is already pending approval.' }
        }

        await prisma.$transaction([
            prisma.content.update({
                where: { id: contentId },
                data: { status: ContentStatus.PENDING_APPROVAL }
            }),
            prisma.approvalQueue.create({
                data: {
                    content_id: contentId,
                    submitted_by: userId,
                    status: ApprovalStatus.PENDING
                }
            })
        ])

        revalidatePath('/dashboard/contents')
        revalidatePath(`/dashboard/contents/${contentId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function reviewApprovalAction(queueId: string, reviewerId: string, status: ApprovalStatus, note: string = '') {
    try {
        const queue = await prisma.approvalQueue.findUnique({ where: { id: queueId } })
        if (!queue) return { success: false, error: 'Approval request not found.' }

        const nextContentStatus = status === ApprovalStatus.APPROVED ? ContentStatus.PUBLISHED : ContentStatus.REJECTED

        await prisma.$transaction([
            prisma.approvalQueue.update({
                where: { id: queueId },
                data: {
                    status,
                    reviewed_by: reviewerId,
                    reviewer_note: note,
                    reviewed_at: new Date()
                }
            }),
            prisma.content.update({
                where: { id: queue.content_id },
                data: {
                    status: nextContentStatus,
                    ...(status === ApprovalStatus.APPROVED ? { published_at: new Date() } : {})
                }
            })
        ])

        // If approved (published), trigger AI processing
        if (nextContentStatus === ContentStatus.PUBLISHED) {
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
                body: JSON.stringify({ contentId: queue.content_id }),
            }).catch(err => console.error('Failed to trigger AI process-content:', err))
        }

        revalidatePath('/dashboard/approvals')
        revalidatePath('/dashboard/contents')
        revalidatePath(`/dashboard/contents/${queue.content_id}`)

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
