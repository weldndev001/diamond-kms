import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const docs: any = await prisma.$queryRaw`SELECT count(*) FROM document_chunks WHERE embedding IS NOT NULL`;
  console.log('Document chunks with embedding count:', docs);

  const publishedContents = await prisma.content.count({
      where: { status: 'PUBLISHED', is_processed: true }
  });
  console.log('Published and processed contents count:', publishedContents);
  
  try {
      const contents: any = await prisma.$queryRaw`SELECT count(*) FROM content_chunks WHERE embedding IS NOT NULL`;
      console.log('Content chunks with embedding count:', contents);
  } catch (err: any) {
      console.error('Error counting content chunks:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
