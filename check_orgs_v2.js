require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const orgs = await prisma.organization.findMany();
    console.log('--- Organizations ---');
    console.log(JSON.stringify(orgs, null, 2));
  } catch (err) {
    console.error('Error fetching orgs:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
