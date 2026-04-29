// lib/ai/chunker.ts
// Semantic-aware chunking — split at paragraph boundaries, not mid-sentence
import type { PageText } from './pdf-extractor'

export interface DocumentChunkData {
    chunkIndex: number
    content: string
    pageStart: number
    pageEnd: number
    tokenCount: number
}

/**
 * Estimate token count: ~1 token per 2.8 characters
 * (conservative for mixed Indonesian/English text, safer for models like Qwen)
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 2.8)
}

/**
 * Chunk document into semantically meaningful segments
 * @param overlapTokens - Overlap between chunks for continuity (default 60)
 */
export function chunkDocument(
    pages: PageText[],
    maxTokens = 420, // Reduced from 600 for safety with 512-token models
    overlapTokens = 60
): DocumentChunkData[] {
    const chunks: DocumentChunkData[] = []
    let currentText = ''
    let currentPageStart = 1
    let currentPageEnd = 1
    let chunkIndex = 0

    for (const page of pages) {
        // Split page into paragraphs
        const paragraphs = page.text
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter((p) => p.length > 5)

        for (let para of paragraphs) {
            // Safety: if a single paragraph is too large, split it by sentences
            if (estimateTokens(para) > maxTokens) {
                const sentences = para.split(/(?<=[.!?])\s+/)
                for (const sentence of sentences) {
                    const combined = currentText ? `${currentText}\n\n${sentence}` : sentence
                    if (estimateTokens(combined) > maxTokens && currentText.length > 0) {
                        chunks.push({
                            chunkIndex: chunkIndex++,
                            content: currentText,
                            pageStart: currentPageStart,
                            pageEnd: currentPageEnd,
                            tokenCount: estimateTokens(currentText),
                        })
                        const overlapText = getLastNTokens(currentText, overlapTokens)
                        currentText = overlapText ? `${overlapText}\n\n${sentence}` : sentence
                        currentPageStart = page.pageNum
                    } else {
                        currentText = combined
                    }
                }
            } else {
                const combined = currentText ? `${currentText}\n\n${para}` : para
                if (estimateTokens(combined) > maxTokens && currentText.length > 0) {
                    chunks.push({
                        chunkIndex: chunkIndex++,
                        content: currentText,
                        pageStart: currentPageStart,
                        pageEnd: currentPageEnd,
                        tokenCount: estimateTokens(currentText),
                    })
                    const overlapText = getLastNTokens(currentText, overlapTokens)
                    
                    // If we have overlap text, the new chunk still starts from the previous chunk's end page
                    // otherwise it starts from the current page
                    const previousPageEnd = currentPageEnd
                    currentText = overlapText ? `${overlapText}\n\n${para}` : para
                    currentPageStart = overlapText ? previousPageEnd : page.pageNum
                } else {
                    // If starting a fresh chunk, set pageStart
                    if (!currentText) currentPageStart = page.pageNum
                    currentText = combined
                }
            }
            currentPageEnd = page.pageNum
        }
    }

    // Flush last chunk
    if (currentText.trim().length > 20) {
        chunks.push({
            chunkIndex,
            content: currentText,
            pageStart: currentPageStart,
            pageEnd: currentPageEnd,
            tokenCount: estimateTokens(currentText),
        })
    }

    return chunks
}

function getLastNTokens(text: string, n: number): string {
    const targetChars = Math.round(n * 3.5)
    if (text.length <= targetChars) return text
    return text.slice(-targetChars)
}
