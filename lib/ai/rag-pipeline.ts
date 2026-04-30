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

function isInventoryQuestion(question: string): boolean {
    return /\b(daftar|isi|data apa|apa saja|apa aja|sumber|dokumen apa|konten apa|sumber apa)\b/i.test(question)
}

async function buildKnowledgeBaseInventoryContext(knowledgeBaseId: string, orgId: string): Promise<string> {
    const kb = await prisma.knowledgeBase.findFirst({
        where: { id: knowledgeBaseId, organization_id: orgId },
        select: {
            name: true,
            description: true,
            status: true,
            group: { select: { name: true } },
            documents: {
                select: {
                    source_id: true,
                    source_type: true,
                },
            },
        },
    })

    if (!kb) return ''

    const documentSourceIds = kb.documents.filter((source) => source.source_type === 'document').map((source) => source.source_id)
    const contentSourceIds = kb.documents.filter((source) => source.source_type === 'content').map((source) => source.source_id)

    const [documents, contents] = await Promise.all([
        documentSourceIds.length > 0
            ? prisma.document.findMany({
                where: { id: { in: documentSourceIds } },
                select: {
                    file_name: true,
                    ai_title: true,
                    ai_summary: true,
                    is_processed: true,
                    group: { select: { name: true } },
                },
            })
            : Promise.resolve([]),
        contentSourceIds.length > 0
            ? prisma.content.findMany({
                where: { id: { in: contentSourceIds } },
                select: {
                    title: true,
                    category: true,
                    status: true,
                    is_processed: true,
                    group: { select: { name: true } },
                },
            })
            : Promise.resolve([]),
    ])

    const lines: string[] = []
    lines.push(`[INVENTARIS KNOWLEDGE BASE]`)
    lines.push(`Nama: ${kb.name}`)
    if (kb.description) lines.push(`Deskripsi: ${kb.description}`)
    lines.push(`Status: ${kb.status}`)
    lines.push(`Grup: ${kb.group?.name || 'Global'}`)
    lines.push(`Jumlah sumber: ${kb.documents.length}`)

    if (documents.length > 0) {
        lines.push(`Dokumen sumber:`)
        documents.slice(0, 12).forEach((doc, index) => {
            const title = doc.ai_title || doc.file_name
            const groupName = doc.group?.name || 'Global'
            const summary = doc.ai_summary ? ` - ${doc.ai_summary.slice(0, 120)}` : ''
            lines.push(`${index + 1}. ${title} [${groupName}]${doc.is_processed ? '' : ' (belum diproses)'}${summary}`)
        })
    }

    if (contents.length > 0) {
        lines.push(`Konten sumber:`)
        contents.slice(0, 12).forEach((content, index) => {
            const groupName = content.group?.name || 'Global'
            lines.push(`${index + 1}. ${content.title} [${groupName}]${content.is_processed ? '' : ' (belum diproses)'} - ${content.category} / ${content.status}`)
        })
    }

    return lines.join('\n')
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
    let kbInventoryContext = ''
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
                // --- QUERY EXPANSION (Multi-Query) ---
                let searchQueries = [question];
                if (question.length > 20) {
                    try {
                        const expansion = await ai.generateCompletion(
                            `Berikan 1 variasi pertanyaan singkat dalam Bahasa Indonesia yang memiliki makna sama dengan: "${question}". Langsung berikan pertanyaannya saja.`,
                            { maxTokens: 50 }
                        );
                        if (expansion && expansion.length > 5) {
                            searchQueries.push(expansion.trim());
                        }
                    } catch (e) {
                        console.warn('[RAG] Query expansion failed', e);
                    }
                }

                const allRelevantChunks: any[] = [];
                for (const q of searchQueries) {
                    const questionEmbedding = await ai.generateEmbedding(q)
                    const vectorStr = JSON.stringify(questionEmbedding)

                    const docGroupFilter = scopedToGroup ? `AND d.group_id = '${groupId}'` : ''
                    const contentGroupFilter = scopedToGroup ? `AND (c.group_id = '${groupId}' OR c.group_id IS NULL)` : ''
                
                    const docKBJoin = knowledgeBaseId ? `JOIN knowledge_base_sources kbs ON kbs.source_id = d.id AND kbs.source_type = 'document' AND kbs.knowledge_base_id = '${knowledgeBaseId}'` : ''
                    const contentKBJoin = knowledgeBaseId ? `JOIN knowledge_base_sources kbs2 ON kbs2.source_id = c.id AND kbs2.source_type = 'content' AND kbs2.knowledge_base_id = '${knowledgeBaseId}'` : ''

                    const chunks = await prisma.$queryRawUnsafe<any[]>(
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
                            LIMIT 10
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
                            LIMIT 10
                        )
                        SELECT * FROM doc_chunks
                        UNION ALL
                        SELECT * FROM content_chunks_raw
                        ORDER BY similarity DESC
                        LIMIT 12
                        `,
                        vectorStr,
                        orgId
                    )
                    allRelevantChunks.push(...chunks);
                }

                // Deduplicate chunks by ID
                const seenIds = new Set();
                relevantChunks = allRelevantChunks.filter(c => {
                    if (seenIds.has(c.chunk_id)) return false;
                    seenIds.add(c.chunk_id);
                    return true;
                });

                // Final sort and limit
                relevantChunks.sort((a, b) => b.similarity - a.similarity);
                
                const threshold = Number(env.AI_SIMILARITY_THRESHOLD) || 0.42 // Slightly lower threshold because we rerank
                relevantChunks = relevantChunks.filter(c => c.similarity > threshold).slice(0, 12)
            }

            // ── STEP 2.5: Vision Embedding Search (Cross-Modal) ──────────
            // Search image chunks using VL model text embedding
            if (useVector && ai.generateVisionQueryEmbedding && ai.visionEmbedModel) {
                try {
                    console.log(`[RAG-PIPELINE] Running cross-modal image search with VL model...`)
                    const visionQueryEmbedding = await ai.generateVisionQueryEmbedding(question)
                    const visionVectorStr = JSON.stringify(visionQueryEmbedding)

                    const docGroupFilter = scopedToGroup ? `AND d.group_id = '${groupId}'` : ''
                    const contentGroupFilter = scopedToGroup ? `AND (c.group_id = '${groupId}' OR c.group_id IS NULL)` : ''
                    const docKBJoin = knowledgeBaseId ? `JOIN knowledge_base_sources kbs ON kbs.source_id = d.id AND kbs.source_type = 'document' AND kbs.knowledge_base_id = '${knowledgeBaseId}'` : ''
                    const contentKBJoin = knowledgeBaseId ? `JOIN knowledge_base_sources kbs2 ON kbs2.source_id = c.id AND kbs2.source_type = 'content' AND kbs2.knowledge_base_id = '${knowledgeBaseId}'` : ''

                    const imageChunks = await prisma.$queryRawUnsafe<any[]>(
                        `
                        WITH doc_image_chunks AS (
                            SELECT
                                dc.id AS chunk_id,
                                d.id AS document_id,
                                COALESCE(d.ai_title, d.file_name) AS doc_title,
                                dc.content,
                                1 - (dc.image_embedding <=> $1::vector) AS similarity,
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
                            AND dc.image_embedding IS NOT NULL
                            AND dc.chunk_type = 'image'
                            ${docGroupFilter}
                            ORDER BY similarity DESC
                            LIMIT 5
                        ),
                        content_image_chunks AS (
                            SELECT
                                cc.id AS chunk_id,
                                c.id AS document_id,
                                c.title AS doc_title,
                                cc.content,
                                1 - (cc.image_embedding <=> $1::vector) AS similarity,
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
                            AND cc.image_embedding IS NOT NULL
                            AND cc.chunk_type = 'image'
                            ${contentGroupFilter}
                            ORDER BY similarity DESC
                            LIMIT 5
                        )
                        SELECT * FROM doc_image_chunks
                        UNION ALL
                        SELECT * FROM content_image_chunks
                        ORDER BY similarity DESC
                        LIMIT 3
                        `,
                        visionVectorStr,
                        orgId
                    )

                    // Filter by threshold and merge with text results
                    const imageThreshold = Number(env.AI_SIMILARITY_THRESHOLD) || 0.40
                    const relevantImageChunks = imageChunks.filter(c => c.similarity > imageThreshold)

                    if (relevantImageChunks.length > 0) {
                        console.log(`[RAG-PIPELINE] Found ${relevantImageChunks.length} relevant image chunk(s)`)
                        // Add image chunks to results (they'll be included in context)
                        relevantChunks.push(...relevantImageChunks)
                    }
                } catch (visionErr) {
                    console.warn('⚠️ [RAG] Vision embedding search failed (non-fatal):', visionErr)
                    // Non-fatal: continue with text-only results
                }
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
            // Default to reranking if we have enough chunks to make it worthwhile
            const shouldRerank = useRerank || (relevantChunks.length > 3);
            if (shouldRerank && relevantChunks.length > 0) {
                relevantChunks = await rerankResults(relevantChunks, question, ai);
                // Keep top 8 after reranking
                relevantChunks = relevantChunks.slice(0, 8);
            }
        }
    } catch (error) {
        console.warn('⚠️ [RAG] RAG search failed. Proceeding as general chat.', error?.toString())
        embeddingFailed = true
        relevantChunks = []
    }

    // ── STEP 4: Build context string from chunks ────────────────
    // Group chunks by document to avoid AI hallucinating more files than exist
    const groupedByDoc = new Map<string, { title: string; sourceType: string; chunks: typeof relevantChunks }>()
    for (const c of relevantChunks) {
        const key = `${c.document_id}::${c.source_type}`
        if (!groupedByDoc.has(key)) {
            groupedByDoc.set(key, { title: c.doc_title, sourceType: c.source_type, chunks: [] })
        }
        groupedByDoc.get(key)!.chunks.push(c)
    }

    let docIndex = 0
    const contextParts: string[] = []
    for (const [, group] of groupedByDoc) {
        docIndex++
        const isDoc = group.sourceType === 'DOCUMENT'
        const label = isDoc ? 'Dokumen' : 'Artikel'
        
        // Include document title clearly for the AI to cite
        contextParts.push(`### ${label} ${docIndex}: ${group.title}`)
        
        const chunkTexts = group.chunks.map((c) => {
            const location = isDoc
                ? `Halaman ${c.page_start}${c.page_end !== c.page_start ? `-${c.page_end}` : ''}`
                : `Bagian ${c.page_start}`
            return `[SUMBER: ${group.title}, ${location}]\n${c.content}`
        }).join('\n\n')
        
        contextParts.push(chunkTexts)
    }
    context = contextParts.join('\n\n---\n\n')

    if (knowledgeBaseId && (isInventoryQuestion(question) || !context.trim())) {
        try {
            kbInventoryContext = await buildKnowledgeBaseInventoryContext(knowledgeBaseId, orgId)
        } catch (inventoryErr) {
            console.warn('⚠️ [RAG] Failed to build KB inventory context', inventoryErr)
        }
    }

    if (kbInventoryContext) {
        context = context ? `${kbInventoryContext}\n\n---\n\n${context}` : kbInventoryContext
    }

    // ── STEP 5: Build system prompt ─────────────────────────────
    let systemPrompt = ''
    const summaryHeader = sessionSummary ? `### RINGKASAN DISKUSI SEBELUMNYA\n${sessionSummary}\n\n` : ''

    const focusInstruction = "\n\nINSTRUKSI PENTING: Fokus pada pertanyaan terbaru user dengan tetap memperhatikan konteks spesifik dari riwayat chat (jika ada skenario/kasus yang sedang dibahas). Berikan jawaban yang TEPAT SASARAN pada kasus tersebut dan JANGAN memberikan rangkuman dokumen/aturan yang tidak relevan dengan detail kejadian spesifik yang ditanyakan."

    if (knowledgeBaseId) {
        systemPrompt = `${summaryHeader}${aiPrompts.aisa.strict_mode}\n${context || 'Daftar dokumen kosong.'}${graphContext}${focusInstruction}`
    } else if (context.trim()) {
        systemPrompt = `${summaryHeader}${aiPrompts.aisa.flexible_mode}\n${context}${graphContext}${focusInstruction}`
    } else {
        systemPrompt = `${summaryHeader}${aiPrompts.aisa.general_mode}${graphContext}${focusInstruction}`
    }

    // ── STEP 6: Build prompt from history + new question ────────
    const historyText = history
        .slice(-20) 
        .map((m) => `${m.role === 'user' ? 'User' : 'Asisten'}: ${m.content}`)
        .join('\n')

    const fullPrompt = historyText
        ? `${historyText}\n\nUser: ${question}`
        : question

    // ── STEP 7: Stream response ─────────────────────────────────
    await ai.streamCompletion(fullPrompt, systemPrompt, onChunk, {}, signal)

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
