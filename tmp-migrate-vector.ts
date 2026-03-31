import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const splitIndex = trimmed.indexOf('=')
      const key = trimmed.substring(0, splitIndex).trim()
      const value = trimmed.substring(splitIndex + 1).trim()
      process.env[key] = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    }
  }
}

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Dropping HNSW indexes...')
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS document_chunks_embedding_idx;`)
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx;`)
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS content_chunks_embedding_idx;`)
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS content_chunks_embedding_hnsw_idx;`)

    console.log('Altering column to generic vector...')
    // We cast the existing vectors to standard generic vector so we don't lose them
    await prisma.$executeRawUnsafe(`ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE content_chunks ALTER COLUMN embedding TYPE vector;`)

    console.log('Database schema successfully updated to accept any vector dimension!')
  } catch (err) {
    console.error('Failed to update schema:', err)
  }
}

main().finally(() => prisma.$disconnect())
