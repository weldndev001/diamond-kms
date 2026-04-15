import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const faqs = await prisma.fAQ.findMany()
  console.log(JSON.stringify(faqs, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
