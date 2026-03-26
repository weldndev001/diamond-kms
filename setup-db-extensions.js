const { Client } = require('pg');

async function setupDatabase() {
    const client = new Client({
        connectionString: "postgresql://diamondkms:weldnDIAMONDKMS2025@db01.weldn.ai:5432/diamondkms"
    });

    try {
        console.log("Mencoba menyambung ke database...");
        await client.connect();
        
        console.log("Menginstal ekstensi 'vector'...");
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log("Ekstensi 'vector' BERHASIL diinstal.");

        console.log("Menginstal ekstensi 'uuid-ossp'...");
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log("Ekstensi 'uuid-ossp' BERHASIL diinstal.");

    } catch (err) {
        console.error("Gagal melakukan setup database:", err.message);
    } finally {
        await client.end();
    }
}

setupDatabase();
