// lib/search/semantic-search.ts
// Cosine similarity search via pgvector with scope enforcement per role
import prisma from '@/lib/prisma'
import { getAIServiceForOrg } from '@/lib/ai/get-ai-service'
import type { Role } from '@prisma/client'

export interface SemanticSearchResult {
  chunkId: string
  documentId: string
  documentTitle: string
  chunkContent: string
  similarity: number
  pageStart: number | null
  pageEnd: number | null
  groupId: string
  groupName: string
  docType: 'document' | 'content'
}

export async function semanticSearch(params: {
  query: string
  orgId: string
  userId: string
  userRole: Role
  groupId: string
  crossGroupEnabled: boolean
  limit?: number
}): Promise<SemanticSearchResult[]> {
  const {
    query,
    orgId,
    userRole,
    groupId,
    crossGroupEnabled,
    limit = 8,
  } = params

  // 1. Embed query using the org's AI provider
  const ai = await getAIServiceForOrg(orgId)
  const queryEmbedding = await ai.generateEmbedding(query)
  const vectorStr = JSON.stringify(queryEmbedding)

  // 2. Determine scope based on role (RAG scope rules)
  const scopedToGroup = !crossGroupEnabled && (userRole === 'STAFF' || userRole === 'SUPERVISOR')

  // 3. Cosine similarity search with pgvector
  // 1 - cosine_distance = similarity (1 = identical, 0 = unrelated)
  const groupFilter = scopedToGroup
    ? `AND d.group_id = '${groupId}'`
    : ''

  const results = await prisma.$queryRawUnsafe<SemanticSearchResult[]>(
    `WITH combined_chunks AS (
          SELECT
            dc.id              AS "chunkId",
            dc.document_id     AS "documentId",
            COALESCE(d.ai_title, d.file_name) AS "documentTitle",
            dc.content         AS "chunkContent",
            1 - (dc.embedding <=> $1::vector) AS "similarity",
            dc.page_number     AS "pageStart",
            COALESCE(dc.page_end, dc.page_number) AS "pageEnd",
            d.group_id      AS "groupId",
            g.name           AS "groupName",
            'document'         AS "docType"
          FROM document_chunks dc
          JOIN documents d   ON dc.document_id = d.id
          JOIN groups g      ON d.group_id  = g.id
          WHERE d.organization_id = $2
            AND d.is_processed   = true
            AND dc.embedding     IS NOT NULL
            ${groupFilter ? `AND d.group_id = '${groupId}'` : ''}
            AND 1 - (dc.embedding <=> $1::vector) > 0.2
            
          UNION ALL
          
          SELECT
            cc.id              AS "chunkId",
            cc.content_id      AS "documentId",
            c.title            AS "documentTitle",
            cc.content         AS "chunkContent",
            1 - (cc.embedding <=> $1::vector) AS "similarity",
            NULL               AS "pageStart",
            NULL               AS "pageEnd",
            c.group_id      AS "groupId",
            g.name           AS "groupName",
            'content'          AS "docType"
          FROM content_chunks cc
          JOIN contents c    ON cc.content_id = c.id
          JOIN groups g      ON c.group_id  = g.id
          WHERE c.organization_id = $2
            AND cc.embedding     IS NOT NULL
            ${groupFilter ? `AND c.group_id = '${groupId}'` : ''}
            AND 1 - (cc.embedding <=> $1::vector) > 0.2
        )
        SELECT * FROM combined_chunks
        ORDER BY "similarity" DESC
        LIMIT $3`,
    vectorStr,
    orgId,
    limit
  )

  return results
}

