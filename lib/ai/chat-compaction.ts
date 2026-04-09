// lib/ai/chat-compaction.ts
import prisma from '@/lib/prisma'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import { logger } from '@/lib/logging/redact'

/**
 * Summarizes the entire chat history for a session 
 * and saves it for context compression.
 */
export async function summarizeSession(sessionId: string, orgId: string) {
    try {
        const session = await prisma.chatSession.findUnique({
            where: { id: sessionId },
            include: {
                messages: {
                    orderBy: { created_at: 'asc' }
                }
            }
        })

        if (!session || session.messages.length < 5) return null

        const historyText = session.messages
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n')

        const ai = await getAIServiceForOrg(orgId)
        
        const prompt = `Anda adalah asisten riset. Tugas Anda adalah membuat RINGKASAN SANGAT PADAT dari percakapan berikut agar asisten bisa melanjutkan diskusi tanpa kehilangan konteks inti.
Tuliskan:
1. Topik utama yang sedang dibahas.
2. Fakta kunci yang sudah ditemukan.
3. Pertanyaan terakhir yang belum terjawab (jika ada).

Format dalam 1-2 paragraf pendek dalam Bahasa Indonesia. JANGAN gunakan format markdown berat.`

        const summary = await ai.generateCompletion(
            `${prompt}\n\nPercakapan:\n${historyText}`,
            { maxTokens: 250 }
        )

        const cleanedSummary = summary.trim()

        await prisma.chatSession.update({
            where: { id: sessionId },
            data: { summary: cleanedSummary }
        })

        logger.info(`Session compaction successful for ${sessionId}`)
        return cleanedSummary
    } catch (error) {
        logger.error(`Session compaction failed for ${sessionId}:`, error)
        return null
    }
}
