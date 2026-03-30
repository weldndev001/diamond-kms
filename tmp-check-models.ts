import { PrismaClient, Prisma } from '@prisma/client'
console.log("Models:", Object.keys(Prisma.ModelName))
const prisma = new PrismaClient()
console.log("Has knowledgeBase?", !!prisma.knowledgeBase)
console.log("Has knowledgeBaseSource?", !!prisma.knowledgeBaseSource)
process.exit(0)
