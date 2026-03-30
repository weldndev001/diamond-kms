const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://diamondkms:weldnDIAMONDKMS2025@db01.weldn.ai:5432/diamondkms'
});

async function main() {
  await client.connect();
  
  try {
      const res = await client.query(`
        SELECT COUNT(*) as count FROM content_chunks WHERE embedding IS NOT NULL
      `);
      console.log('content_chunks count => ', res.rows[0].count);
      
      const res2 = await client.query(`
        SELECT COUNT(*) as count FROM contents WHERE status = 'PUBLISHED' AND is_processed = true
      `);
      console.log('published processed contents count => ', res2.rows[0].count);

      const res3 = await client.query(`
        WITH combined_chunks AS (
                SELECT
                    dc.id AS chunk_id,
                    'DOCUMENT' AS source_type
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id

                UNION ALL

                SELECT
                    cc.id AS chunk_id,
                    'ARTICLE' AS source_type
                FROM content_chunks cc
                JOIN contents c ON cc.content_id = c.id
                WHERE c.status = 'PUBLISHED'
            )
            SELECT source_type, count(*) as cnt FROM combined_chunks GROUP BY source_type
      `);
      console.log('UNION results => ', res3.rows);
      
  } catch (err) {
      console.error('PG ERROR: ', err.message);
  } finally {
      await client.end();
  }
}

main();
