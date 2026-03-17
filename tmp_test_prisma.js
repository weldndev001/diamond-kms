
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const data = {
      title: "nasi goreng",
      description: "nasi goreng",
      time_limit_minutes: 10,
      division_id: "adf69e87-afa7-47aa-a361-5dbf8dd70093",
      content_id: null,
      organization_id: "12385b28-9e94-4c3d-80d6-5cab03d1a9d5",
      created_by: "27d072fd-28b8-406d-a03f-b66755617b21",
      is_published: true,
      questions: {
        create: [
          {
            question_text: "test",
            question_type: "MULTIPLE_CHOICE",
            options: ["A", "B"],
            correct_answer: "A",
            image: "test-image-data",
            order_index: 0
          }
        ]
      }
    };

    console.log("Attempting to create quiz with data...");
    const result = await prisma.quiz.create({ data });
    console.log("Success ID:", result.id);
  } catch (error) {
    console.error("Error detected:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
