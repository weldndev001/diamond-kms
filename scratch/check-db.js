const { Client } = require('pg');
require('dotenv').config();

async function checkCols() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'document_chunks';
    `);
    console.log('Columns in document_chunks:');
    console.table(res.rows);
    
    const extRes = await client.query(`SELECT extname FROM pg_extension;`);
    console.log('Extensions installed:');
    console.table(extRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkCols();
