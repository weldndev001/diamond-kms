
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function checkUser() {
  const email = 'test@diamondkms.com'; // Probable test email based on history
  console.log(`Checking user: ${email}`);
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        user_groups: {
          include: { group: true }
        }
      }
    });

    if (!user) {
      console.log('User NOT FOUND');
      const allUsers = await prisma.user.findMany({ take: 5 });
      console.log('Sample users in DB:', allUsers.map(u => u.email));
      return;
    }

    console.log('User FOUND:', {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isActive: user.is_active,
      groupsCount: user.user_groups.length
    });

    if (user.password_hash) {
       // Check with a known common password if user is okay with it
       // But better just check if hash exists
       console.log('Password hash exists.');
    } else {
       console.log('Password hash is MISSING.');
    }

  } catch (error) {
    console.error('Database query ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
