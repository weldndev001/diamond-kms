import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.knowledgeBase.count();
    console.log('KnowledgeBase table exists. Current count:', count);
  } catch (error) {
    console.error('KnowledgeBase table DOES NOT exist or error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
