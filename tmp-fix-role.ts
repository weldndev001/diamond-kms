import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

// Read .env.local manually
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
  const user = await prisma.user.findFirst({
    where: { full_name: 'Super Admin' }
  })
  if (user) {
    const result = await prisma.userDivision.updateMany({
      where: { user_id: user.id },
      data: { role: 'SUPER_ADMIN' }
    })
    console.log(`Role updated to SUPER_ADMIN! Modified ${result.count} records.`)
  } else {
    console.log('User "Super Admin" not found.')
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
