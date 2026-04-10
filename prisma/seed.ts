import { PrismaClient, Role, ContentStatus } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // 1. Create Demo Organization (IT Segment)
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-it' },
    update: {},
    create: {
      name: 'Acme IT Solutions',
      slug: 'acme-it',
      industry_segment: 'IT',
      subscription_status: 'ACTIVE',
      subscription_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Next year
      ai_provider_config: { provider: 'managed' },
    },
  })

  // 2. Create Groups
  const engGroup = await prisma.group.upsert({
    where: { id: 'seed-group-engineering' },
    update: {},
    create: {
      id: 'seed-group-engineering',
      organization_id: org.id,
      name: 'Engineering',
      description: 'Software engineering team',
    },
  })

  const prodGroup = await prisma.group.upsert({
    where: { id: 'seed-group-product' },
    update: {},
    create: {
      id: 'seed-group-product',
      organization_id: org.id,
      name: 'Product',
      description: 'Product management team',
    },
  })

  // 3. Create Users
  console.log('Seeding users...')
  const supervisorId = '00000000-0000-0000-0000-000000000004'
  const groupAdminId = '00000000-0000-0000-0000-000000000003'
  
  const userRoles = [
    { id: '00000000-0000-0000-0000-000000000001', name: 'System Maintainer', title: 'System Engineer', role: Role.MAINTAINER },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Alice Admin', title: 'HR Director', role: Role.SUPER_ADMIN },
    { id: groupAdminId, name: 'Bob GroupAdmin', title: 'VP of Engineering', role: Role.GROUP_ADMIN },
    { id: supervisorId, name: 'Charlie Supervisor', title: 'Engineering Manager', role: Role.SUPERVISOR },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Dave Staff', title: 'Software Engineer', role: Role.STAFF },
  ]

  for (const u of userRoles) {
    // We check if user exists first to avoid complex upsert with relations in a loop
    const existingUser = await prisma.user.findUnique({ where: { id: u.id } })
    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: u.id,
          organization_id: org.id,
          full_name: u.name,
          job_title: u.title,
          is_active: true,
          user_groups: {
            create: {
              group_id: engGroup.id,
              role: u.role,
              is_primary: true
            }
          }
        }
      })
    }
  }

  // 4. Sample Content
  console.log('Seeding samples...')
  const contentSamples = [
    { title: 'Q4 Engineering Goals', body: '<p>Drafting the goals for Q4...</p>', category: 'Tech Wiki', status: ContentStatus.DRAFT, authorId: supervisorId },
    { title: 'New Code Review Standards', body: '<p>We need to focus on performance during code reviews.</p>', category: 'Code Standards', status: ContentStatus.PENDING_APPROVAL, authorId: supervisorId, hasQueue: true },
    { title: 'Company Architecture Overview', body: '<p>This is the high level architecture of our system...</p>', category: 'Tech Wiki', status: ContentStatus.PUBLISHED, authorId: groupAdminId, isMandatory: true },
    { title: 'Deprecated Library Usage', body: '<p>We are going to use X instead of Y.</p>', category: 'Code Standards', status: ContentStatus.REJECTED, authorId: supervisorId },
  ]

  for (const s of contentSamples) {
    const existing = await prisma.content.findFirst({ where: { title: s.title } })
    if (!existing) {
      const created = await prisma.content.create({
        data: {
          organization_id: org.id,
          group_id: engGroup.id,
          author_id: s.authorId,
          title: s.title,
          body: s.body,
          category: s.category,
          status: s.status,
          published_at: s.status === ContentStatus.PUBLISHED ? new Date() : null,
          is_mandatory_read: s.isMandatory || false,
        }
      })

      if (s.hasQueue) {
        await prisma.approvalQueue.create({
          data: {
            content_id: created.id,
            submitted_by: s.authorId,
          }
        })
      }
    }
  }

  // 5. Sample Client Instances (Monitoring)
  console.log('Seeding client instances...')
  const clientData = [
    {
      instance_key: 'acme-corp-prod',
      client_name: 'Acme Corp Production',
      status: 'online',
      cpu_percent: 45.2,
      memory_percent: 62.8,
      disk_percent: 34.1,
      health_score: 98.5,
      license_plan: 'enterprise',
    },
    {
      instance_key: 'globex-it-staging',
      client_name: 'Globex IT Solutions',
      status: 'warning',
      cpu_percent: 12.5,
      memory_percent: 85.0,
      disk_percent: 92.4,
      health_score: 72.4,
      license_plan: 'pro',
    },
    {
      instance_key: 'stark-ind-demo',
      client_name: 'Stark Industries Demo',
      status: 'offline',
      cpu_percent: 0,
      memory_percent: 0,
      disk_percent: 0,
      health_score: 0,
      license_plan: 'basic',
    }
  ]

  for (const c of clientData) {
    await prisma.clientInstance.upsert({
      where: { instance_key: c.instance_key },
      update: { ...c },
      create: {
        ...c,
        app_version: '1.2.4',
        last_heartbeat: new Date(),
        uptime_seconds: 1209600,
        db_status: 'connected',
        db_size_mb: 1240.5,
        db_connections: 84,
        total_users: 1250,
        total_groups: 12,
        total_documents: 4500,
        total_contents: 850,
        ai_provider: 'managed',
        ai_model: 'gemini-1.5-pro',
        ai_status: 'healthy',
        ai_avg_response_ms: 1240,
        ai_success_rate: 99.4,
        ai_tokens_30d: 450000,
        dau_today: 412,
        chat_sessions_7d: 1240,
        read_rate: 78.5,
        license_expires: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      }
    })
  }

  console.log('Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
