
const prisma = require('./lib/prisma').default;

async function main() {
  try {
    const data = {
      title: "nasi goreng",
      description: "nasi goreng",
      division_id: "adf69e87-afa7-47aa-a361-5dbf8dd70093",
      organization_id: "12385b28-9e94-4c3d-80d6-5cab03d1a9d5",
      created_by: "27d072fd-28b8-406d-a03f-b66755617b21",
      questions: {
        create: [
          {
            question_text: "test",
            question_type: "MULTIPLE_CHOICE",
            options: ["A"],
            correct_answer: "A",
            image: "test",
            order_index: 0
          }
        ]
      }
    };
    console.log("Testing prisma.quiz.create...");
    // We don't actually need to execute it, just check if it fails during validation if possible,
    // or just run it and see the error.
    const result = await prisma.quiz.create({ data });
    console.log("Success!");
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

main();
