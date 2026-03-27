const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'test@diamondkms.com' },
    include: {
      user_divisions: {
        include: {
          division: true
        }
      }
    }
  });

  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
