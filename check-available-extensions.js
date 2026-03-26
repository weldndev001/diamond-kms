const { Client } = require('pg');

async function checkExtensions() {
    const client = new Client({
        connectionString: "postgresql://diamondkms:weldnDIAMONDKMS2025@db01.weldn.ai:5432/diamondkms"
    });

    try {
        await client.connect();
        
        console.log("Daftar ekstensi yang TERSEDIA di server:");
        const res = await client.query("SELECT name, default_version, installed_version, comment FROM pg_available_extensions WHERE name IN ('vector', 'uuid-ossp') ORDER BY name");
        
        if (res.rows.length === 0) {
            console.log("Tidak ada ekstensi 'vector' atau 'uuid-ossp' yang tersedia di pg_available_extensions.");
        } else {
            console.table(res.rows);
        }

        const allRes = await client.query("SELECT count(*) FROM pg_available_extensions");
        console.log(`Total ekstensi tersedia: ${allRes.rows[0].count}`);

    } catch (err) {
        console.error("Gagal mengecek ekstensi:", err.message);
    } finally {
        await client.end();
    }
}

checkExtensions();
