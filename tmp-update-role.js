const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env')
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
    const userCount = await prisma.user.count()
    console.log(`Connection successful. Total users: ${userCount}`)
    
    const email = 'test@diamondkms.com'
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        user_divisions: true
      }
    })
    
    if (user) {
      console.log(`User found: ${user.full_name}`)
      const result = await prisma.userDivision.updateMany({
        where: { user_id: user.id },
        data: { role: 'SUPER_ADMIN' }
      })
      console.log(`Updated ${result.count} roles.`)
    } else {
      console.log(`User ${email} not found.`)
      const someUsers = await prisma.user.findMany({ take: 5, select: { email: true } })
      console.log('Sample users:', someUsers.map(u => u.email))
    }
  } catch (err) {
    console.error('Error:', err.message)
    if (err.code) console.error('Code:', err.code)
    if (err.meta) console.error('Meta:', err.meta)
  } finally {
    await prisma.$disconnect()
  }
}

main()
