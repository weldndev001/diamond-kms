import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: { full_name: 'Super Admin' }
  })
  if (user) {
    await prisma.userDivision.updateMany({
      where: { user_id: user.id },
      data: { role: 'SUPER_ADMIN' }
    })
    console.log('Role updated to SUPER_ADMIN!')
  } else {
    console.log('User not found.')
  }
}

main().finally(() => prisma.$disconnect())
