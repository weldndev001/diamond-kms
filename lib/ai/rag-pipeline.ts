// lib/ai/rag-pipeline.ts
// Retrieval-Augmented Generation pipeline
// Question → embed → cosine search top-8 chunks → build context → stream LLM answer + citations
import prisma from '@/lib/prisma'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import type { Role } from '@prisma/client'

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
        onChunk,
        signal,
    } = params

    // ── STEP 1: Scope filter based on role ──────────────────────
    const scopedToDiv = !crossDivisionEnabled && (userRole === 'STAFF' || userRole === 'SUPERVISOR')

    const ai = await getAIServiceForOrg(orgId)

    let relevantChunks: any[] = []
    let context = ''
    let embeddingFailed = false

    try {
        // ── STEP 2: Embed the question ──────────────────────────────
        const questionEmbedding = await ai.generateEmbedding(question)
        const vectorStr = JSON.stringify(questionEmbedding)

        // ── STEP 3: Cosine similarity search — top 8 chunks (Documents + Articles) ─────────
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

        // Filter out chunks with very low similarity (e.g., < 0.3)
        relevantChunks = relevantChunks.filter(c => c.similarity > 0.3)
    } catch (error) {
        console.warn('⚠️ [RAG] Embedding generation or vector search failed. Proceeding as general chat.', error?.toString())
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
    let systemPrompt = `Anda adalah asisten AI cerdas, luwes, dan ramah untuk karyawan di organisasi ini.`

    if (knowledgeBaseId) {
        // STRICT MODE for Knowledge Base
        systemPrompt = `Halo! Saya AISA, asisten pintar Anda. 
Tugas saya adalah membantu Anda memahami isi Knowledge Base ini dengan cara yang ramah dan mudah dimengerti.

ATURAN MAIN (WAJIB):
1. JAWABLAH SECARA ULTRA-SINGKAT, PADAT, DAN JELAS. Langsung pada inti jawaban.
2. JANGAN PERNAH GUNAKAN SIMBOL BINTANG (**) ATAU MARKDOWN APAPUN. Gunakan TEKS BIASA polos (Plain Text).
3. Gunakan bahasa Indonesia yang BAIK, BENAR, DAN MUDAH DIMENGERTI. Tetap ramah seperti asisten profesional, tapi hindari bahasa gaul/slang yang tidak baku.
4. Jika user bertanya "intinya", "kesimpulannya", atau sejenisnya, berikan ringkasan dalam 1-2 kalimat yang sangat jelas.
5. JANGAN mengulang pertanyaan user atau memberikan pendahuluan yang panjang lebar.
6. Tetap cantumkan sumber di akhir kalimat (format: [Sumber N]).

KONTEKS DOKUMEN:
${context || 'Daftar dokumen kosong. Beritahu user untuk menambahkan dokumen ke Knowledge Base ini.'}`
    } else if (context.trim()) {
        // Flexible mode for general documents
        systemPrompt += `\n\nTugas saya adalah membantu Anda menjawab pertanyaan berdasarkan dokumen yang ada. 

Aturan:
1. JAWABLAH DENGAN SANGAT RINGKAS DAN JELAS. 
2. JANGAN PERNAH GUNAKAN SIMBOL BINTANG (**). Gunakan TEKS BIASA polos.
3. Gunakan bahasa yang ramah dan profesional. Hindari slang atau kata-kata yang membingungkan.
4. Jika diminta "intinya", berikan 1 kalimat kesimpulan yang paling penting.

KONTEKS DOKUMEN:
${context}`
    } else {
        // General Assistant mode
        systemPrompt += `\n\nSaat ini tidak ada konteks dokumen internal spesifik yang ditemukan. 
Aturan:
1. Anda bebas menjawab pertanyaan umum atau merespons sapaan menggunakan pengetahuan Anda.
2. JANGAN berkata "Informasi tidak ditemukan" kecuali ditanya file spesifik.
3. JAWABLAH SECARA ULTRA-SINGKAT DAN JELAS dalam bahasa Indonesia yang baik dan ramah.
4. JANGAN PERNAH GUNAKAN SIMBOL BINTANG (**). Gunakan TEKS BIASA polos (Plain Text).`
    }

    // ── STEP 6: Build prompt from history + new question ────────
    const historyText = history
        .slice(-6) // Last 6 messages (3 turns)
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
