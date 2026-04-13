const { Client } = require('pg');
require('dotenv').config();

async function fixDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    console.log('Enabling vector extension...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('Extension enabled.');

    console.log('Adding embedding column to document_chunks...');
    await client.query(`ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector;`);
    
    console.log('Adding embedding column to content_chunks...');
    await client.query(`ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS embedding vector;`);
    
    console.log('DB Fix completed successfully.');
  } catch (err) {
    console.error('Error during DB fix:', err);
  } finally {
    await client.end();
  }
}

fixDb();
