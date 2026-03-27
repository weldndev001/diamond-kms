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
    const resultDocs = await prisma.$queryRaw`
      SELECT data_type, udt_name, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'document_chunks' AND column_name = 'embedding';
    `
    console.log('document_chunks.embedding:', resultDocs)

    const resultContent = await prisma.$queryRaw`
      SELECT data_type, udt_name, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'content_chunks' AND column_name = 'embedding';
    `
    console.log('content_chunks.embedding:', resultContent)
    
  } catch (error) {
    console.error(error)
  }
}

main().finally(() => prisma.$disconnect())
