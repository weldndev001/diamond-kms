const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const email = 'test@diamondkms.com'
  const password = '123456'
  const fullName = 'Test Super Admin'
  
  console.log('Creating test user...')

  try {
    // 1. Get or create organization
    let org = await prisma.organization.findFirst({
      where: { slug: 'diamond-kms' }
    })

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Diamond KMS',
          slug: 'diamond-kms',
          industry_segment: 'Technology',
          subscription_status: 'ACTIVE',
        }
      })
      console.log(`Created Organization: ${org.name}`)
    } else {
      console.log(`Using existing Organization: ${org.name}`)
    }

    // 2. Get or create group
    let group = await prisma.group.findFirst({
      where: { organization_id: org.id }
    })

    if (!group) {
      group = await prisma.group.create({
        data: {
          organization_id: org.id,
          name: 'General',
          description: 'General group for the organization',
        }
      })
      console.log(`Created Group: ${group.name}`)
    } else {
      console.log(`Using existing Group: ${group.name}`)
    }

    // 3. Hash password
    const passwordHash = bcrypt.hashSync(password, 10)

    // 4. Create/Update user
    const user = await prisma.user.upsert({
      where: { email: email },
      update: {
        password_hash: passwordHash,
        full_name: fullName,
        is_active: true,
      },
      create: {
        email: email,
        password_hash: passwordHash,
        full_name: fullName,
        organization_id: org.id,
        is_active: true,
      }
    })

    // 5. Ensure UserGroup exists
    await prisma.userGroup.upsert({
      where: {
        user_id_group_id: {
          user_id: user.id,
          group_id: group.id
        }
      },
      update: {
        role: 'SUPER_ADMIN',
        is_primary: true
      },
      create: {
        user_id: user.id,
        group_id: group.id,
        role: 'SUPER_ADMIN',
        is_primary: true
      }
    })

    console.log(`Success! User created/updated: ${email}`)
    console.log(`Role: SUPER_ADMIN`)
    console.log(`Organization: ${org.name}`)
  } catch (error) {
    console.error('Error creating user:', error)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
