const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const doc = await prisma.document.findUnique({
            where: { id: '82a1a680-3319-4d7b-9bb2-e8281d57497b' }
        });
        console.log(JSON.stringify(doc, null, 2));
    } catch (error) {
        console.error('Error fetching document:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
