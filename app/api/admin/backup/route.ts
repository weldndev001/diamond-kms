import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
    try {
        // Export all tables as JSON
        const [
            organizations,
            featureFlags,
            users,
            groups,
            userGroups,
            documents,
            documentChunks,
            documentEntities,
            documentRelationships,
            contents,
            contentVersions,
            contentChunks,
            contentEntities,
            contentRelationships,
            approvals,
            revisionSuggestions,
            quizzes,
            quizQuestions,
            quizResults,
            readTrackers,
            userPoints,
            faqs,
            notifications,
            subscriptions,
            invoices,
            aiUsageLogs,
            chatSessions,
            chatMessages,
        ] = await Promise.all([
            prisma.organization.findMany(),
            prisma.featureFlag.findMany(),
            prisma.user.findMany(),
            prisma.group.findMany(),
            prisma.userGroup.findMany(),
            prisma.document.findMany(),
            prisma.documentChunk.findMany({ select: { id: true, document_id: true, chunk_index: true, content: true, token_count: true, page_number: true, created_at: true } }),
            prisma.documentEntity.findMany(),
            prisma.documentRelationship.findMany(),
            prisma.content.findMany(),
            prisma.contentVersion.findMany(),
            prisma.contentChunk.findMany({ select: { id: true, content_id: true, chunk_index: true, content: true, token_count: true, created_at: true } }),
            prisma.contentEntity.findMany(),
            prisma.contentRelationship.findMany(),
            prisma.approvalQueue.findMany(),
            prisma.revisionSuggestion.findMany(),
            prisma.quiz.findMany(),
            prisma.quizQuestion.findMany(),
            prisma.quizResult.findMany(),
            prisma.readTracker.findMany(),
            prisma.userPoints.findMany(),
            prisma.fAQ.findMany(),
            prisma.notification.findMany(),
            prisma.subscription.findMany(),
            prisma.invoice.findMany(),
            prisma.aIUsageLog.findMany(),
            prisma.chatSession.findMany(),
            prisma.chatMessage.findMany(),
        ])

        const backup = {
            _meta: {
                version: '1.0',
                created_at: new Date().toISOString(),
                tables: 28,
            },
            organizations,
            featureFlags,
            users,
            groups,
            userGroups,
            documents,
            documentChunks,
            documentEntities,
            documentRelationships,
            contents,
            contentVersions,
            contentChunks,
            contentEntities,
            contentRelationships,
            approvals,
            revisionSuggestions,
            quizzes,
            quizQuestions,
            quizResults,
            readTrackers,
            userPoints,
            faqs,
            notifications,
            subscriptions,
            invoices,
            aiUsageLogs,
            chatSessions,
            chatMessages,
        }

        const json = JSON.stringify(backup, null, 2)
        const fileName = `diamond-kms-backup-${new Date().toISOString().slice(0, 10)}.json`

        return new NextResponse(json, {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        })
    } catch (err: any) {
        console.error('[Backup] Error:', err)
        return NextResponse.json({ error: err.message || 'Backup failed' }, { status: 500 })
    }
}

// GET to check backup status / info
export async function GET() {
    try {
        const counts = await Promise.all([
            prisma.organization.count(),
            prisma.user.count(),
            prisma.document.count(),
            prisma.content.count(),
            prisma.chatSession.count(),
            prisma.chatMessage.count(),
            prisma.quiz.count(),
            prisma.userPoints.count(),
        ])

        return NextResponse.json({
            tables: {
                organizations: counts[0],
                users: counts[1],
                documents: counts[2],
                contents: counts[3],
                chatSessions: counts[4],
                chatMessages: counts[5],
                quizzes: counts[6],
                userPoints: counts[7],
            },
            totalRecords: counts.reduce((a: number, b: number) => a + b, 0),
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
