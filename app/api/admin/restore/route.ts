import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
    try {
        const backup = await req.json()

        if (!backup._meta || !backup.organizations) {
            return NextResponse.json({ error: 'Format backup tidak valid' }, { status: 400 })
        }

        const results: Record<string, number> = {}

        // Import in dependency order using upsert to handle conflicts
        // 1. Organizations first
        if (backup.organizations?.length) {
            for (const row of backup.organizations) {
                await prisma.organization.upsert({
                    where: { id: row.id },
                    update: { ...row, created_at: new Date(row.created_at) },
                    create: { ...row, created_at: new Date(row.created_at) },
                })
            }
            results.organizations = backup.organizations.length
        }

        // 2. Users
        if (backup.users?.length) {
            for (const row of backup.users) {
                await prisma.user.upsert({
                    where: { id: row.id },
                    update: { ...row, created_at: new Date(row.created_at) },
                    create: { ...row, created_at: new Date(row.created_at) },
                })
            }
            results.users = backup.users.length
        }

        // 3. Groups
        if (backup.groups?.length) {
            for (const row of backup.groups) {
                await prisma.group.upsert({
                    where: { id: row.id },
                    update: { ...row, created_at: new Date(row.created_at) },
                    create: { ...row, created_at: new Date(row.created_at) },
                })
            }
            results.groups = backup.groups.length
        }

        // 4. Feature Flags
        if (backup.featureFlags?.length) {
            for (const row of backup.featureFlags) {
                await prisma.featureFlag.upsert({
                    where: { id: row.id },
                    update: { ...row, created_at: new Date(row.created_at) },
                    create: { ...row, created_at: new Date(row.created_at) },
                })
            }
            results.featureFlags = backup.featureFlags.length
        }

        // 5. UserGroups
        if (backup.userGroups?.length) {
            for (const row of backup.userGroups) {
                await prisma.userGroup.upsert({
                    where: { id: row.id },
                    update: row,
                    create: row,
                })
            }
            results.userGroups = backup.userGroups.length
        }

        // 6. Documents
        if (backup.documents?.length) {
            for (const row of backup.documents) {
                const data = { ...row }
                if (data.created_at) data.created_at = new Date(data.created_at)
                if (data.updated_at) data.updated_at = new Date(data.updated_at)
                await prisma.document.upsert({
                    where: { id: row.id },
                    update: data,
                    create: data,
                })
            }
            results.documents = backup.documents.length
        }

        // 7. DocumentChunks (skip embedding)
        if (backup.documentChunks?.length) {
            let imported = 0
            for (const row of backup.documentChunks) {
                try {
                    const data = { ...row }
                    delete data.embedding
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.documentChunk.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { /* skip chunks with FK errors */ }
            }
            results.documentChunks = imported
        }

        // 8. DocumentEntities
        if (backup.documentEntities?.length) {
            let imported = 0
            for (const row of backup.documentEntities) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.documentEntity.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.documentEntities = imported
        }

        // 9. DocumentRelationships
        if (backup.documentRelationships?.length) {
            let imported = 0
            for (const row of backup.documentRelationships) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.documentRelationship.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.documentRelationships = imported
        }

        // 10. Contents
        if (backup.contents?.length) {
            for (const row of backup.contents) {
                const data = { ...row }
                if (data.created_at) data.created_at = new Date(data.created_at)
                if (data.updated_at) data.updated_at = new Date(data.updated_at)
                if (data.published_at) data.published_at = new Date(data.published_at)
                await prisma.content.upsert({
                    where: { id: row.id },
                    update: data,
                    create: data,
                })
            }
            results.contents = backup.contents.length
        }

        // 11. ContentVersions
        if (backup.contentVersions?.length) {
            let imported = 0
            for (const row of backup.contentVersions) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.contentVersion.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.contentVersions = imported
        }

        // 12. ContentChunks (skip embedding)
        if (backup.contentChunks?.length) {
            let imported = 0
            for (const row of backup.contentChunks) {
                try {
                    const data = { ...row }
                    delete data.embedding
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.contentChunk.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.contentChunks = imported
        }

        // 13. ContentEntities
        if (backup.contentEntities?.length) {
            let imported = 0
            for (const row of backup.contentEntities) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.contentEntity.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.contentEntities = imported
        }

        // 14. ContentRelationships
        if (backup.contentRelationships?.length) {
            let imported = 0
            for (const row of backup.contentRelationships) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.contentRelationship.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.contentRelationships = imported
        }

        // 15. Approvals
        if (backup.approvals?.length) {
            let imported = 0
            for (const row of backup.approvals) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.approvalQueue.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.approvals = imported
        }

        // 16. RevisionSuggestions
        if (backup.revisionSuggestions?.length) {
            let imported = 0
            for (const row of backup.revisionSuggestions) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.revisionSuggestion.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.revisionSuggestions = imported
        }

        // 17. Quizzes
        if (backup.quizzes?.length) {
            for (const row of backup.quizzes) {
                const data = { ...row }
                if (data.created_at) data.created_at = new Date(data.created_at)
                await prisma.quiz.upsert({
                    where: { id: row.id },
                    update: data,
                    create: data,
                })
            }
            results.quizzes = backup.quizzes.length
        }

        // 18. QuizQuestions
        if (backup.quizQuestions?.length) {
            let imported = 0
            for (const row of backup.quizQuestions) {
                try {
                    await prisma.quizQuestion.upsert({
                        where: { id: row.id },
                        update: row,
                        create: row,
                    })
                    imported++
                } catch { }
            }
            results.quizQuestions = imported
        }

        // 19. QuizResults
        if (backup.quizResults?.length) {
            let imported = 0
            for (const row of backup.quizResults) {
                try {
                    const data = { ...row }
                    if (data.completed_at) data.completed_at = new Date(data.completed_at)
                    await prisma.quizResult.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.quizResults = imported
        }

        // 20. ReadTrackers
        if (backup.readTrackers?.length) {
            let imported = 0
            for (const row of backup.readTrackers) {
                try {
                    const data = { ...row }
                    if (data.read_at) data.read_at = new Date(data.read_at)
                    await prisma.readTracker.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.readTrackers = imported
        }

        // 21. UserPoints
        if (backup.userPoints?.length) {
            let imported = 0
            for (const row of backup.userPoints) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.userPoints.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.userPoints = imported
        }

        // 22. FAQs
        if (backup.faqs?.length) {
            let imported = 0
            for (const row of backup.faqs) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.fAQ.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.faqs = imported
        }

        // 23. Notifications
        if (backup.notifications?.length) {
            let imported = 0
            for (const row of backup.notifications) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.notification.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.notifications = imported
        }

        // 24. Subscriptions
        if (backup.subscriptions?.length) {
            let imported = 0
            for (const row of backup.subscriptions) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    if (data.expires_at) data.expires_at = new Date(data.expires_at)
                    await prisma.subscription.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.subscriptions = imported
        }

        // 25. Invoices
        if (backup.invoices?.length) {
            let imported = 0
            for (const row of backup.invoices) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    if (data.period_start) data.period_start = new Date(data.period_start)
                    if (data.period_end) data.period_end = new Date(data.period_end)
                    await prisma.invoice.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.invoices = imported
        }

        // 26. AIUsageLogs
        if (backup.aiUsageLogs?.length) {
            let imported = 0
            for (const row of backup.aiUsageLogs) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.aIUsageLog.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.aiUsageLogs = imported
        }

        // 27. ChatSessions
        if (backup.chatSessions?.length) {
            for (const row of backup.chatSessions) {
                const data = { ...row }
                if (data.created_at) data.created_at = new Date(data.created_at)
                if (data.updated_at) data.updated_at = new Date(data.updated_at)
                await prisma.chatSession.upsert({
                    where: { id: row.id },
                    update: data,
                    create: data,
                })
            }
            results.chatSessions = backup.chatSessions.length
        }

        // 28. ChatMessages
        if (backup.chatMessages?.length) {
            let imported = 0
            for (const row of backup.chatMessages) {
                try {
                    const data = { ...row }
                    if (data.created_at) data.created_at = new Date(data.created_at)
                    await prisma.chatMessage.upsert({
                        where: { id: row.id },
                        update: data,
                        create: data,
                    })
                    imported++
                } catch { }
            }
            results.chatMessages = imported
        }

        return NextResponse.json({
            success: true,
            message: 'Import selesai',
            results,
        })
    } catch (err: any) {
        console.error('[Restore] Error:', err)
        return NextResponse.json({ error: err.message || 'Import gagal' }, { status: 500 })
    }
}
