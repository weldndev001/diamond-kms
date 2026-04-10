// lib/search/hybrid-search.ts
// Combines full-text + semantic search, with fallback if AI is down
import prisma from '@/lib/prisma'
import {
    semanticSearch,
    type SemanticSearchResult,
} from './semantic-search'
import type { Role } from '@prisma/client'

export interface HybridSearchResult {
    id: string
    type: 'document' | 'content' | 'faq'
    title: string
    excerpt: string
    score: number // 0-1, combined rank
    source: 'semantic' | 'fulltext' | 'both'
    pageStart?: number | null
    pageEnd?: number | null
    groupName?: string
}

export async function hybridSearch(params: {
    query: string
    orgId: string
    userId: string
    userRole: Role
    groupId: string
    crossGroupEnabled: boolean
}): Promise<HybridSearchResult[]> {
    const { query, orgId, userRole, groupId, crossGroupEnabled } = params

    // Run full-text and semantic search in parallel
    const [ftResults, semResults] = await Promise.allSettled([
        fullTextSearch({
            query,
            orgId,
            userRole,
            groupId,
            crossGroupEnabled,
        }),
        semanticSearch({
            query,
            orgId,
            userId: params.userId,
            userRole,
            groupId,
            crossGroupEnabled,
        }),
    ])

    const ftList = ftResults.status === 'fulfilled' ? ftResults.value : []
    const semList = semResults.status === 'fulfilled' ? semResults.value : []

    // Merge and deduplicate
    const merged = mergeResults(ftList, semList)
    return merged.sort((a, b) => b.score - a.score).slice(0, 20)
}

// ─── Full-text search (SQL ILIKE fallback) ──────────────────────
async function fullTextSearch(params: {
    query: string
    orgId: string
    userRole: Role
    groupId: string
    crossGroupEnabled: boolean
}): Promise<HybridSearchResult[]> {
    const { query, orgId, userRole, groupId, crossGroupEnabled } = params
    const scopedToGroup = !crossGroupEnabled && (userRole === 'STAFF' || userRole === 'SUPERVISOR')

    const words = query.trim().split(/\s+/).filter(w => w.length > 2)
    const exactQuery = query.trim()

    const docWordConditions = words.flatMap(w => [
        { ai_title: { contains: w, mode: 'insensitive' } },
        { ai_summary: { contains: w, mode: 'insensitive' } },
        { file_name: { contains: w, mode: 'insensitive' } },
    ])

    const contentWordConditions = words.flatMap(w => [
        { title: { contains: w, mode: 'insensitive' } },
        { body: { contains: w, mode: 'insensitive' } },
    ])

    const docWhereClause: Record<string, unknown> = {
        organization_id: orgId,
        is_processed: true,
        OR: docWordConditions.length > 0 ? [
            { ai_title: { contains: exactQuery, mode: 'insensitive' } },
            { ai_summary: { contains: exactQuery, mode: 'insensitive' } },
            { file_name: { contains: exactQuery, mode: 'insensitive' } },
            ...docWordConditions
        ] : [
            { ai_title: { contains: exactQuery, mode: 'insensitive' } },
            { ai_summary: { contains: exactQuery, mode: 'insensitive' } },
            { file_name: { contains: exactQuery, mode: 'insensitive' } },
        ],
    }
    const contentWhereClause: Record<string, unknown> = {
        organization_id: orgId,
        is_processed: true,
        OR: contentWordConditions.length > 0 ? [
            { title: { contains: exactQuery, mode: 'insensitive' } },
            { body: { contains: exactQuery, mode: 'insensitive' } },
            ...contentWordConditions
        ] : [
            { title: { contains: exactQuery, mode: 'insensitive' } },
            { body: { contains: exactQuery, mode: 'insensitive' } },
        ],
    }

    if (scopedToGroup) {
        docWhereClause.group_id = groupId
        contentWhereClause.group_id = groupId
    }

    const [docRows, contentRows] = await Promise.all([
        prisma.document.findMany({
            where: docWhereClause as any,
            include: { group: { select: { name: true } } },
            take: 10,
            orderBy: { created_at: 'desc' },
        }),
        prisma.content.findMany({
            where: contentWhereClause as any,
            include: { group: { select: { name: true } } },
            take: 10,
            orderBy: { created_at: 'desc' },
        })
    ])

    const docResults = docRows.map((r) => ({
        id: r.id,
        type: 'document' as const,
        title: r.ai_title || r.file_name,
        excerpt: r.ai_summary?.slice(0, 200) || '',
        score: 0.5, // Base score for full-text match
        source: 'fulltext' as const,
        groupName: r.group?.name,
    }))

    const contentResults = contentRows.map((r) => ({
        id: r.id,
        type: 'content' as const,
        title: r.title,
        excerpt: r.body.replace(/<[^>]*>?/gm, '').slice(0, 200), // Strip HTML and limit
        score: 0.5,
        source: 'fulltext' as const,
        groupName: r.group?.name,
    }))

    return [...docResults, ...contentResults]
}

// ─── Merge results ─────────────────────────────────────────────
function mergeResults(
    ftResults: HybridSearchResult[],
    semResults: SemanticSearchResult[]
): HybridSearchResult[] {
    const map = new Map<string, HybridSearchResult>()

    // Use a composite key like "type:id" to prevent collision between content and document
    ftResults.forEach((r) => map.set(`${r.type}:${r.id}`, r))

    semResults.forEach((sem) => {
        const key = `${sem.docType}:${sem.documentId}`
        const existing = map.get(key)

        if (existing) {
            // Found in both — boost score
            existing.score = Math.min(Math.max(existing.score, sem.similarity) * 1.2, 1)
            existing.source = 'both'
            existing.pageStart = sem.pageStart
            existing.pageEnd = sem.pageEnd
            existing.excerpt = sem.chunkContent.slice(0, 200)
        } else {
            map.set(key, {
                id: sem.documentId,
                type: sem.docType,
                title: sem.documentTitle,
                excerpt: sem.chunkContent.slice(0, 200),
                score: sem.similarity,
                source: 'semantic',
                pageStart: sem.pageStart,
                pageEnd: sem.pageEnd,
                groupName: sem.groupName,
            })
        }
    })

    return Array.from(map.values())
}
