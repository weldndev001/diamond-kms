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
        const org = await prisma.organization.findFirst({
            select: { id: true, name: true, ai_provider_config: true }
        })
        console.log('Org config:', JSON.stringify(org, null, 2))
    } catch (err) {
        console.error(err)
    }
}
main().finally(() => prisma.$disconnect())
