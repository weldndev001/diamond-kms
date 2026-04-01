import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

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
  const email = 'test@diamondkms.com'
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      user_divisions: {
        include: {
          division: true
        }
      },
      organization: true
    }
  })

  if (!user) {
    console.log(`User with email ${email} not found.`)
    // Check all users just in case
    const allUsers = await prisma.user.findMany({ select: { email: true } })
    console.log('Available users:', allUsers.map(u => u.email).join(', '))
    return
  }

  console.log(`Found user: ${user.full_name} (${user.email})`)
  console.log(`Organization: ${user.organization.name} (${user.organization.id})`)
  
  if (user.user_divisions.length === 0) {
    console.log('User has no divisions. Finding default division for organization...')
    const division = await prisma.division.findFirst({
      where: { organization_id: user.organization_id }
    })
    
    if (division) {
      await prisma.userDivision.create({
        data: {
          user_id: user.id,
          division_id: division.id,
          role: 'SUPER_ADMIN',
          is_primary: true
        }
      })
      console.log(`Added user to division ${division.name} as SUPER_ADMIN.`)
    } else {
      console.log('No division found for organization. Creating a default division...')
       const newDivision = await prisma.division.create({
        data: {
          organization_id: user.organization_id,
          name: 'Main Division',
          description: 'Default division'
        }
      })
      await prisma.userDivision.create({
        data: {
          user_id: user.id,
          division_id: newDivision.id,
          role: 'SUPER_ADMIN',
          is_primary: true
        }
      })
      console.log(`Created division ${newDivision.name} and added user as SUPER_ADMIN.`)
    }
  } else {
    // Also check if any of them is already SUPER_ADMIN
    const result = await prisma.userDivision.updateMany({
      where: { user_id: user.id },
      data: { role: 'SUPER_ADMIN' }
    })
    console.log(`Updated ${result.count} division roles to SUPER_ADMIN.`)
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
