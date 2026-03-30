import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rsld: any = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count FROM documents d WHERE d.is_processed = true
  `);
  console.log('Processed Docs:', rsld[0].count);

  const rslc: any = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count FROM contents c WHERE c.is_processed = true AND c.status = 'PUBLISHED'
  `);
  console.log('Processed Contents:', rslc[0].count);

  const rslcd: any = await prisma.$queryRawUnsafe(`
    SELECT count(*) as count FROM document_chunks dc WHERE dc.embedding IS NOT NULL
  `);
  console.log('Doc Chunks with embeddings:', rslcd[0].count);

  const rslcc: any = await prisma.$queryRawUnsafe(`
    SELECT count(*) as count FROM content_chunks cc WHERE cc.embedding IS NOT NULL
  `);
  console.log('Content Chunks with embeddings:', rslcc[0].count);

  const orgs: any = await prisma.organization.findMany({ take: 1 });
  if (orgs.length > 0) {
    const orgId = orgs[0].id;
    console.log('Querying UNION ALL for org:', orgId);
    
    // We mock a zero vector for test
    const mockVector = Array.from({length: 1536}).map(() => 0);
    const vectorStr = JSON.stringify(mockVector);
    
    try {
      const relevantChunks: any = await prisma.$queryRawUnsafe(`
            WITH combined_chunks AS (
                SELECT
                    dc.id AS chunk_id,
                    'DOCUMENT' AS source_type
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE d.organization_id = $2
                  AND d.is_processed = true
                  AND dc.embedding IS NOT NULL

                UNION ALL

                SELECT
                    cc.id AS chunk_id,
                    'ARTICLE' AS source_type
                FROM content_chunks cc
                JOIN contents c ON cc.content_id = c.id
                WHERE c.organization_id = $2
                  AND c.status = 'PUBLISHED'
                  AND c.is_processed = true
                  AND cc.embedding IS NOT NULL
            )
            SELECT source_type, count(*) as cnt FROM combined_chunks GROUP BY source_type
      `, vectorStr, orgId);
      
      console.log('UNION results:', relevantChunks);
    } catch(err: any) {
      console.error('UNION ALl Error:', err.message);
    }
  }
}

main().finally(() => prisma.$disconnect());
