const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log("Checking Prisma Models...")
  const models = Object.keys(prisma).filter(key => !key.startsWith('$') && !key.startsWith('_'))
  console.log("Available Models:", models)
  console.log("knowledgeBase exists:", !!prisma.knowledgeBase)
  console.log("knowledgeBaseSource exists:", !!prisma.knowledgeBaseSource)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
