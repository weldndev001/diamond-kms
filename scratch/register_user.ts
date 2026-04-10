import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
  const prisma = new PrismaClient()
  const email = 'test@diamondkms.com'
  const password = '123456'
  const fullName = 'Test Super Admin'
  
  console.log('Creating test user...')

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
  const passwordHash = await bcrypt.hash(password, 10)

  // 4. Create user
  try {
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
        role: Role.SUPER_ADMIN,
        is_primary: true
      },
      create: {
        user_id: user.id,
        group_id: group.id,
        role: Role.SUPER_ADMIN,
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
  }
}

main()
