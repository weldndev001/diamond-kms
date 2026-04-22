// Run migration script - executes each SQL statement separately
const { Client } = require('pg');
require('dotenv').config();

const statements = [
    // Step 1: Add columns to document_chunks
    `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS image_embedding vector(768)`,
    `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS chunk_type TEXT NOT NULL DEFAULT 'text'`,
    `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS image_source TEXT`,
    
    // Step 2: Add columns to content_chunks
    `ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS image_embedding vector(768)`,
    `ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS chunk_type TEXT NOT NULL DEFAULT 'text'`,
    `ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS image_source TEXT`,
    
    // Step 3: HNSW indexes for image_embedding
    `CREATE INDEX IF NOT EXISTS idx_doc_chunks_image_embedding ON document_chunks USING hnsw (image_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
    `CREATE INDEX IF NOT EXISTS idx_content_chunks_image_embedding ON content_chunks USING hnsw (image_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
    
    // Step 4: indexes on chunk_type
    `CREATE INDEX IF NOT EXISTS idx_doc_chunks_type ON document_chunks (chunk_type)`,
    `CREATE INDEX IF NOT EXISTS idx_content_chunks_type ON content_chunks (chunk_type)`,
];

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        console.log('Connected to database');
        
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            console.log(`[${i+1}/${statements.length}] ${stmt.substring(0, 80)}...`);
            await client.query(stmt);
            console.log('  OK');
        }
        
        console.log('\nMigration SUCCESS!');
    } catch (e) {
        console.error('Migration FAILED:', e.message);
    } finally {
        await client.end();
    }
}

run();
