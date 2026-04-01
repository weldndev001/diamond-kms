const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      user_divisions: {
        include: {
          division: true
        }
      },
      organization: true
    }
  });

  const summary = users.map(u => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    organization: u.organization.name,
    divisions: u.user_divisions.map(ud => ({
      division: ud.division.name,
      role: ud.role,
      is_primary: ud.is_primary
    }))
  }));

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
