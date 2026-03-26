const { Client } = require('pg');

async function testConnection() {
    const client = new Client({
        connectionString: "postgresql://diamondkms:weldnDIAMONDKMS2025@db01.weldn.ai:5432/diamondkms"
    });

    try {
        console.log("Mencoba menyambung ke database...");
        await client.connect();
        console.log("Koneksi BERHASIL!");
        
        const res = await client.query('SELECT version()');
        console.log("Versi PostgreSQL:", res.rows[0].version);

        // Check for pgvector
        try {
            const vectorExt = await client.query("SELECT * FROM pg_extension WHERE extname = 'vector'");
            if (vectorExt.rows.length > 0) {
                console.log("Ekstensi 'vector' TERDETEKSI.");
            } else {
                console.log("Ekstensi 'vector' TIDAK DITEMUKAN. Perlu diinstal: 'CREATE EXTENSION IF NOT EXISTS vector;'");
            }
        } catch (err) {
            console.log("Gagal mengecek ekstensi vector:", err.message);
        }

    } catch (err) {
        console.error("Koneksi GAGAL:", err.message);
    } finally {
        await client.end();
    }
}

testConnection();
