const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ 
        connectionString,
        ssl: { rejectUnauthorized: false },
    });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        const doc = await prisma.document.findUnique({
            where: { id: '82a1a680-3319-4d7b-9bb2-e8281d57497b' }
        });
        console.log('DOCUMENT_DATA_START');
        console.log(JSON.stringify(doc, null, 2));
        console.log('DOCUMENT_DATA_END');
    } catch (error) {
        console.error('Error fetching document:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
