
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const contents = await prisma.content.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      is_processed: true,
      _count: {
        select: { chunks: true }
      }
    }
  })
  console.log('--- Contents ---')
  console.log(JSON.stringify(contents, null, 2))

  const kbs = await prisma.knowledgeBase.findMany({
    include: {
      documents: true
    }
  })
  console.log('--- Knowledge Bases ---')
  console.log(JSON.stringify(kbs, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
