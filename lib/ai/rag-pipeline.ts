// lib/ai/rag-pipeline.ts
// Retrieval-Augmented Generation pipeline
// Question → embed → cosine search top-8 chunks → build context → stream LLM answer + citations
import prisma from '@/lib/prisma'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import type { Role } from '@prisma/client'
import type { AIService } from './types'
import aiPrompts from '@/ai-prompts.json'
import { env } from '@/lib/env'

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export interface Citation {
    documentId: string
    documentTitle: string
    pageStart: number
    pageEnd: number
    groupName: string
    chunkContent: string // snippet for preview
    sourceType: 'DOCUMENT' | 'ARTICLE'
}

export interface RAGQueryParams {
    question: string
    history: ChatMessage[]
    userId: string
    orgId: string
    userRole: Role
    groupId: string
    crossGroupEnabled: boolean
    knowledgeBaseId?: string
    sessionSummary?: string // Added for context compaction
    useVector?: boolean
    useGraph?: boolean
    useRerank?: boolean
    onChunk: (text: string) => void
    signal?: AbortSignal
}

/**
 * Rerank retrieval results using a Cross-Encoder model.
 */
async function rerankResults(results: any[], query: string, ai: AIService): Promise<any[]> {
    if (results.length === 0) return results;

    try {
        console.log(`[RAG-PIPELINE] Reranking ${results.length} results...`);
        const documents = results.map((r: any) => r.content);
        const reranked = await ai.rerank(query, documents);

        // Map scores back to original results
        const scoredResults = reranked.map((r: { index: number; score: number }) => {
            const original = results[r.index];
            return {
                ...original,
                rerank_score: r.score,
                // Update similarity for ordering if needed, but we'll sort by rerank_score
            };
        });

        // Sort by rerank score descending
        return scoredResults.sort((a: any, b: any) => b.rerank_score - a.rerank_score);
    } catch (err) {
        console.warn('⚠️ [Rerank] Reranking failed, falling back to vector similarity.', err);
        return results.sort((a: any, b: any) => b.similarity - a.similarity);
    }
}

export async function ragQuery(
    params: RAGQueryParams
): Promise<Citation[]> {
    const {
        question,
        history,
        orgId,
        userRole,
        groupId,
        crossGroupEnabled,
        knowledgeBaseId,
        sessionSummary,
        onChunk,
        signal,
    } = params

    // ── STEP 1: Scope filter based on role ──────────────────────
    const scopedToGroup = !crossGroupEnabled && (userRole === 'STAFF' || userRole === 'SUPERVISOR')

    const ai = await getAIServiceForOrg(orgId)

    let relevantChunks: any[] = []
    let context = ''
    let graphContext = ''
    let embeddingFailed = false

    try {
        // Destructure flags with defaults
        const { useVector = true, useGraph = true, useRerank = false } = params;

        // --- CHIT-CHAT INTERCEPTOR ---
        const chitChatRegex = /^(ya|tidak|oke|ok|baik|sip|mantap|keren|halo|hai|hi|thanks|makasih|terima kasih|terimakasih|oh begitu|oh begitu ya|oh gitu|ouh begitu|ouh begitu ya|okelah|siap|ngerti|paham)[\s\.\,\!\?]*$/i;
        if (chitChatRegex.test(question.trim())) {
            // Skip search
        } else {
            // ── STEP 2 & 3: Vector Retrieval ───────────────────────────
            if (useVector) {
                const questionEmbedding = await ai.generateEmbedding(question)
                const vectorStr = JSON.stringify(questionEmbedding)

                const docGroupFilter = scopedToGroup ? `AND d.group_id = '${groupId}'` : ''
                const contentGroupFilter = scopedToGroup ? `AND (c.group_id = '${groupId}' OR c.group_id IS NULL)` : ''
            
                const docKBJoin = knowledgeBaseId ? `JOIN knowledge_base_sources kbs ON kbs.source_id = d.id AND kbs.source_type = 'document' AND kbs.knowledge_base_id = '${knowledgeBaseId}'` : ''
                const contentKBJoin = knowledgeBaseId ? `JOIN knowledge_base_sources kbs2 ON kbs2.source_id = c.id AND kbs2.source_type = 'content' AND kbs2.knowledge_base_id = '${knowledgeBaseId}'` : ''

                relevantChunks = await prisma.$queryRawUnsafe<any[]>(
                    `
                    WITH doc_chunks AS (
                        SELECT
                            dc.id AS chunk_id,
                            d.id AS document_id,
                            COALESCE(d.ai_title, d.file_name) AS doc_title,
                            dc.content,
                            1 - (dc.embedding <=> $1::vector) AS similarity,
                            dc.page_number AS page_start,
                            COALESCE(dc.page_end, dc.page_number) AS page_end,
                            g.name AS group_name,
                            'DOCUMENT' AS source_type
                        FROM document_chunks dc
                        JOIN documents d ON dc.document_id = d.id
                        JOIN groups g ON d.group_id = g.id
                        ${docKBJoin}
                        WHERE d.organization_id = $2
                        AND d.is_processed = true
                        AND dc.embedding IS NOT NULL
                        ${docGroupFilter}
                        ORDER BY similarity DESC
                        LIMIT 15
                    ),
                    content_chunks_raw AS (
                        SELECT
                            cc.id AS chunk_id,
                            c.id AS document_id,
                            c.title AS doc_title,
                            cc.content,
                            1 - (cc.embedding <=> $1::vector) AS similarity,
                            cc.chunk_index AS page_start,
                            cc.chunk_index AS page_end,
                            COALESCE(g.name, 'Global') AS group_name,
                            'ARTICLE' AS source_type
                        FROM content_chunks cc
                        JOIN contents c ON cc.content_id = c.id
                        LEFT JOIN groups g ON c.group_id = g.id
                        ${contentKBJoin}
                        WHERE c.organization_id = $2
                        AND c.status = 'PUBLISHED'
                        AND c.is_processed = true
                        AND cc.embedding IS NOT NULL
                        ${contentGroupFilter}
                        ORDER BY similarity DESC
                        LIMIT 15
                    ),
                    combined_chunks AS (
                        SELECT * FROM doc_chunks
                        UNION ALL
                        SELECT * FROM content_chunks_raw
                    ),
                    ranked_chunks AS (
                        SELECT *,
                            ROW_NUMBER() OVER(PARTITION BY document_id ORDER BY similarity DESC) as doc_rank
                        FROM combined_chunks
                    )
                    SELECT * FROM ranked_chunks
                    WHERE doc_rank <= 3
                    ORDER BY similarity DESC
                    LIMIT 8
                    `,
                    vectorStr,
                    orgId
                )

                const threshold = Number(env.AI_SIMILARITY_THRESHOLD) || 0.40
                relevantChunks = relevantChunks.filter(c => c.similarity > threshold)
            }

            // ── STEP 3.5: Graph Expansion (Graph RAG) ──────────────────
            if (useGraph) {
                try {
                    let docIds: string[] = []
                    let contentIds: string[] = []

                    if (useVector && relevantChunks.length > 0) {
                        // Seed from vector results
                        docIds = [...new Set(relevantChunks.filter(c => c.source_type === 'DOCUMENT').map(c => c.document_id))]
                        contentIds = [...new Set(relevantChunks.filter(c => c.source_type === 'ARTICLE').map(c => c.document_id))]
                    } else {
                        // Graph Only Mode: Seed from keyword search on entities (Name & Description)
                        const searchTerms = question.trim().split(/\s+/).filter(w => w.length > 2).slice(0, 5)
                        if (searchTerms.length > 0) {
                            const [matchedDocEntities, matchedContentEntities] = await Promise.all([
                                prisma.documentEntity.findMany({
                                    where: {
                                        OR: searchTerms.map(term => ({
                                            OR: [
                                                { name: { contains: term, mode: 'insensitive' } },
                                                { description: { contains: term, mode: 'insensitive' } }
                                            ]
                                        }))
                                    },
                                    select: { document_id: true },
                                    take: 10
                                }),
                                prisma.contentEntity.findMany({
                                    where: {
                                        OR: searchTerms.map(term => ({
                                            OR: [
                                                { name: { contains: term, mode: 'insensitive' } },
                                                { description: { contains: term, mode: 'insensitive' } }
                                            ]
                                        }))
                                    },
                                    select: { content_id: true },
                                    take: 10
                                })
                            ])
                            docIds = [...new Set(matchedDocEntities.map(e => e.document_id))]
                            contentIds = [...new Set(matchedContentEntities.map(e => e.content_id))]
                        }
                    }

                    if (docIds.length > 0 || contentIds.length > 0) {
                        // Fetch entities linked to these documents/content
                        const [entities, contentEntities] = await Promise.all([
                            prisma.documentEntity.findMany({
                                where: { document_id: { in: docIds } },
                                take: 20
                            }),
                            prisma.contentEntity.findMany({
                                where: { content_id: { in: contentIds } },
                                take: 20
                            })
                        ])

                        const allEntities = [...entities, ...contentEntities]
                        const entityIds = allEntities.map(e => e.id)

                        // Fetch relationships between these entities
                        const relationships = await prisma.documentRelationship.findMany({
                            where: {
                                OR: [
                                    { source_entity_id: { in: entityIds } },
                                    { target_entity_id: { in: entityIds } }
                                ]
                            },
                            include: {
                                source_entity: true,
                                target_entity: true
                            },
                            take: 15
                        })

                        if (allEntities.length > 0 || relationships.length > 0) {
                            graphContext = "\n\n### KNOWLEDGE GRAPH CONTEXT\n"
                            if (allEntities.length > 0) {
                                graphContext += "Entitas Terkait:\n" + allEntities.map(e => `- ${e.name} (${e.type}): ${e.description || ''}`).join('\n') + "\n"
                            }
                            if (relationships.length > 0) {
                                graphContext += "Hubungan antar Entitas:\n" + relationships.map(r => `- ${r.source_entity.name} ${r.relationship} ${r.target_entity.name} (${r.description || ''})`).join('\n')
                            }
                        }
                    }
                } catch (graphErr) {
                    console.warn('⚠️ [Graph RAG] Failed to fetch graph context', graphErr)
                }
            }

            // ── STEP 3.7: Reranking (Feature Toggle) ────────────────────
            if (useRerank && relevantChunks.length > 0) {
                relevantChunks = await rerankResults(relevantChunks, question, ai);
            }
        }
    } catch (error) {
        console.warn('⚠️ [RAG] RAG search failed. Proceeding as general chat.', error?.toString())
        embeddingFailed = true
        relevantChunks = []
    }

    // ── STEP 4: Build context string from chunks ────────────────
    context = relevantChunks
        .map((c, i) => {
            const isDoc = c.source_type === 'DOCUMENT'
            const location = isDoc
                ? `Hal. ${c.page_start}${c.page_end !== c.page_start ? `-${c.page_end}` : ''}`
                : `Bagian ${c.page_start}`
            return `[Sumber ${i + 1}: ${c.doc_title}, ${location}]\n${c.content}`
        })
        .join('\n\n---\n\n')

    // ── STEP 5: Build system prompt ─────────────────────────────
    let systemPrompt = ''
    const summaryHeader = sessionSummary ? `### RINGKASAN DISKUSI SEBELUMNYA\n${sessionSummary}\n\n` : ''

    if (knowledgeBaseId) {
        systemPrompt = `${summaryHeader}${aiPrompts.aisa.strict_mode}\n${context || 'Daftar dokumen kosong.'}${graphContext}`
    } else if (context.trim()) {
        systemPrompt = `${summaryHeader}${aiPrompts.aisa.flexible_mode}\n${context}${graphContext}`
    } else {
        systemPrompt = `${summaryHeader}${aiPrompts.aisa.general_mode}${graphContext}`
    }

    // ── STEP 6: Build prompt from history + new question ────────
    const historyText = history
        .slice(-6) 
        .map((m) => `${m.role === 'user' ? 'User' : 'Asisten'}: ${m.content}`)
        .join('\n')

    const fullPrompt = historyText
        ? `${historyText}\n\nUser: ${question}`
        : question

    // ── STEP 7: Stream response ─────────────────────────────────
    await ai.streamCompletion(fullPrompt, systemPrompt, onChunk, signal)

    // ── STEP 8: Return citations ────────────────────────────────
    const citations: Citation[] = relevantChunks.map((c) => ({
        documentId: c.document_id,
        documentTitle: c.doc_title,
        pageStart: c.page_start,
        pageEnd: c.page_end,
        groupName: c.group_name,
        chunkContent: c.content.slice(0, 150),
        sourceType: c.source_type as 'DOCUMENT' | 'ARTICLE',
    }))

    return citations
}
