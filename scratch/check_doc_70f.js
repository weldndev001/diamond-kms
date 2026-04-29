
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDoc() {
  const docId = '70f33b08-20df-47bf-a3c6-530bfd62dfa2';
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      file_name: true,
      ai_title: true,
      ai_summary: true,
      is_processed: true,
      chunks: {
        select: { id: true },
      },
    }
  });

  console.log('Document:', JSON.stringify(doc, null, 2));
  console.log('Chunk count:', doc.chunks.length);

  const chunks = await prisma.document_chunks.findMany({
    where: { document_id: docId },
    take: 5
  });
  console.log('Sample chunks content length:', chunks.map(c => c.content.length));
}

checkDoc();
