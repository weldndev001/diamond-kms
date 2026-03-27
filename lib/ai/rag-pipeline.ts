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
        onChunk,
        signal,
    } = params

    // ── STEP 1: Scope filter based on role ──────────────────────
    const scopedToDiv =
        userRole === 'STAFF' ||
        (userRole === 'SUPERVISOR' && !crossDivisionEnabled)

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
            WITH combined_chunks AS (
                -- 1. Get from Document Chunks
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
                WHERE d.organization_id = $2
                  AND d.is_processed = true
                  AND dc.embedding IS NOT NULL
                  ${docDivFilter}

                UNION ALL

                -- 2. Get from Content (Article) Chunks
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
                WHERE c.organization_id = $2
                  AND c.status = 'PUBLISHED'
                  AND c.is_processed = true
                  AND cc.embedding IS NOT NULL
                  ${contentDivFilter}
            )
            SELECT * FROM combined_chunks
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
    // Dynamic system prompt: if we have context, prioritize it. 
    // If we don't, allow the AI to be a helpful general assistant instead of a strict document reader.
    let systemPrompt = `Anda adalah asisten AI cerdas, luwes, dan ramah untuk karyawan di organisasi ini.`

    if (context.trim()) {
        systemPrompt += `\n\nTugas utama Anda adalah menjawab pertanyaan berdasarkan Kumpulan Dokumen di bawah ini.
Aturan:
1. Jika jawaban ada di dalam dokumen, JAWABLAH dengan mengandalkan data tersebut dan cantumkan sumbernya (format: [Sumber N]).
2. Jika pertanyaan TIDAK ADA HUBUNGANNYA dengan dokumen (misalnya pengguna menyapa, bertanya kabar, atau bertanya hal umum sehari-hari), JAWABLAH SEPERTI BIASA layaknya asisten yang pintar. ANDA TIDAK PERLU BERKATA "Informasi tidak ditemukan di dokumen" untuk percakapan umum.
3. JANGAN GUNAKAN FORMAT MARKDOWN ATAU BINTANG (seperti **teks tebal**, *miring*, dsb). Gunakan teks murni saja.
4. JANGAN GUNAKAN poin-poin (bullet points) seperti * atau -. Gunakan penomoran angka (1, 2, 3) atau huruf (a, b, c) untuk daftar/poin-poin.

KONTEKS DOKUMEN:
${context}`
    } else {
        systemPrompt += `\n\nSaat ini tidak ada konteks dokumen internal spesifik yang ditemukan untuk pertanyaan pengguna. 
Aturan:
1. Anda bebas menjawab pertanyaan umum, berbincang ramah, atau merespons sapaan menggunakan pengetahuan luas Anda sendiri.
2. JANGAN berkata "Informasi tidak ditemukan di dokumen" kecuali jika pengguna memang ngotot menanyakan file spesifik.
3. JANGAN GUNAKAN FORMAT MARKDOWN/BINTANG. Gunakan penomoran angka untuk daftar.`
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
