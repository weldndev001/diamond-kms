const { Client } = require('pg');

async function debugExtensions() {
    const client = new Client({
        connectionString: "postgresql://diamondkms:weldnDIAMONDKMS2025@db01.weldn.ai:5432/diamondkms"
    });

    try {
        await client.connect();
        
        console.log("Mencek ekstensi 'vector'...");
        const res = await client.query("SELECT * FROM pg_available_extensions WHERE name = 'vector'");
        
        if (res.rows.length === 0) {
            console.log("HASIL: Ekstensi 'vector' TIDAK TERSEDIA di server (pg_available_extensions kosong).");
            console.log("Saran: Pastikan library 'postgresql-17-pgvector' terinstal dan service postgresql sudah di-restart.");
        } else {
            console.log("HASIL: Ekstensi 'vector' TERSEDIA untuk diinstal!");
            console.table(res.rows);
        }

        console.log("Mencek ekstensi 'uuid-ossp'...");
        const uuidRes = await client.query("SELECT * FROM pg_available_extensions WHERE name = 'uuid-ossp'");
        if (uuidRes.rows.length > 0) {
            console.log("HASIL: Ekstensi 'uuid-ossp' TERSEDIA.");
        } else {
            console.log("HASIL: Ekstensi 'uuid-ossp' TIDAK TERSEDIA.");
        }

    } catch (err) {
        console.error("Gagal melakukan debug ekstensi:", err.message);
    } finally {
        await client.end();
    }
}

debugExtensions();
