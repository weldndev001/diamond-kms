
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    console.log("Attempting to create quiz...");
    const result = await prisma.quiz.create({ data });
    console.log("Success:", result);
  } catch (error) {
    console.error("Error detected:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
