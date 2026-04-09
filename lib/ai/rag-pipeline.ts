// lib/ai/rag-pipeline.ts
// Retrieval-Augmented Generation pipeline
// Question → embed → cosine search top-8 chunks → build context → stream LLM answer + citations
import prisma from '@/lib/prisma'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import type { Role } from '@prisma/client'
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
    divisionName: string
    chunkContent: string // snippet for preview
    sourceType: 'DOCUMENT' | 'ARTICLE'
}

export interface RAGQueryParams {
    question: string
    history: ChatMessage[]
    userId: string
    orgId: string
    userRole: Role
    divisionId: string
    crossDivisionEnabled: boolean
    knowledgeBaseId?: string
    sessionSummary?: string // Added for context compaction
    onChunk: (text: string) => void
    signal?: AbortSignal
}

export async function ragQuery(
    params: RAGQueryParams
): Promise<Citation[]> {
    const {
        question,
        history,
        orgId,
        userRole,
        divisionId,
        crossDivisionEnabled,
        knowledgeBaseId,
        sessionSummary,
        onChunk,
        signal,
    } = params

    // ── STEP 1: Scope filter based on role ──────────────────────
    const scopedToDiv = !crossDivisionEnabled && (userRole === 'STAFF' || userRole === 'SUPERVISOR')

    const ai = await getAIServiceForOrg(orgId)

    let relevantChunks: any[] = []
    let context = ''
    let graphContext = ''
    let embeddingFailed = false

    try {
        // --- CHIT-CHAT INTERCEPTOR ---
        const chitChatRegex = /^(ya|tidak|oke|ok|baik|sip|mantap|keren|halo|hai|hi|thanks|makasih|terima kasih|terimakasih|oh begitu|oh begitu ya|oh gitu|ouh begitu|ouh begitu ya|okelah|siap|ngerti|paham)[\s\.\,\!\?]*$/i;
        if (chitChatRegex.test(question.trim())) {
            // Skip search
        } else {
            // ── STEP 2: Embed the question ──────────────────────────────
            const questionEmbedding = await ai.generateEmbedding(question)
            const vectorStr = JSON.stringify(questionEmbedding)

            // ── STEP 3: Cosine similarity search — top 8 chunks ─────────
            const docDivFilter = scopedToDiv ? `AND d.division_id = '${divisionId}'` : ''
            const contentDivFilter = scopedToDiv ? `AND (c.division_id = '${divisionId}' OR c.division_id IS NULL)` : ''
        
            const docKBJoin = knowledgeBaseId ? `JOIN knowledge_base_sources kbs ON kbs.source_id = d.id AND kbs.source_type = 'document' AND kbs.knowledge_base_id = '${knowledgeBaseId}'` : ''
            const contentKBJoin = knowledgeBaseId ? `JOIN knowledge_base_sources kbs2 ON kbs2.source_id = c.id AND kbs2.source_type = 'content' AND kbs2.knowledge_base_id = '${knowledgeBaseId}'` : ''

            relevantChunks = await prisma.$queryRawUnsafe<
                {
                    chunk_id: string
                    document_id: string
                    doc_title: string
                    content: string
                    similarity: number
                    page_start: number
                    page_end: number
                    division_name: string
                    source_type: 'DOCUMENT' | 'ARTICLE'
                }[]
            >(
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
                        div.name AS division_name,
                        'DOCUMENT' AS source_type
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    JOIN divisions div ON d.division_id = div.id
                    ${docKBJoin}
                    WHERE d.organization_id = $2
                      AND d.is_processed = true
                      AND dc.embedding IS NOT NULL
                      ${docDivFilter}
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
                        COALESCE(div.name, 'Global') AS division_name,
                        'ARTICLE' AS source_type
                    FROM content_chunks cc
                    JOIN contents c ON cc.content_id = c.id
                    LEFT JOIN divisions div ON c.division_id = div.id
                    ${contentKBJoin}
                    WHERE c.organization_id = $2
                      AND c.status = 'PUBLISHED'
                      AND c.is_processed = true
                      AND cc.embedding IS NOT NULL
                      ${contentDivFilter}
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

            // ── STEP 3.5: Graph Expansion (Graph RAG) ──────────────────
            if (relevantChunks.length > 0) {
                try {
                    const docIds = [...new Set(relevantChunks.filter(c => c.source_type === 'DOCUMENT').map(c => c.document_id))]
                    const contentIds = [...new Set(relevantChunks.filter(c => c.source_type === 'ARTICLE').map(c => c.document_id))]

                    // Fetch entities linked to these documents
                    const entities = await prisma.documentEntity.findMany({
                        where: { document_id: { in: docIds } },
                        take: 20
                    })

                    const contentEntities = await prisma.contentEntity.findMany({
                        where: { content_id: { in: contentIds } },
                        take: 20
                    })

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
                } catch (graphErr) {
                    console.warn('⚠️ [Graph RAG] Failed to fetch graph context', graphErr)
                }
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
        divisionName: c.division_name,
        chunkContent: c.content.slice(0, 150),
        sourceType: c.source_type as 'DOCUMENT' | 'ARTICLE',
    }))

    return citations
}
