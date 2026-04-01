const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function createTestAccount() {
  const client = new Client({
    connectionString: "postgresql://diamondkms:weldnDIAMONDKMS2025@db01.weldn.ai:5432/diamondkms",
  });

  try {
    await client.connect();
    console.log('Connected to database!');

    // 1. Check for Organizations
    let orgRes = await client.query(`SELECT id FROM organizations LIMIT 1`);
    let orgId;

    if (orgRes.rows.length === 0) {
      console.log('No organizations found. Creating default one...');
      orgId = crypto.randomUUID();
      await client.query(`
        INSERT INTO organizations (
          id, name, slug, industry_segment, subscription_status, system_language, app_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [orgId, 'Diamond KMS Test', 'test-org', 'Technology', 'ACTIVE', 'id', 'DIAMOND KMS']);
      console.log('Organization created: Diamond KMS Test');
    } else {
      orgId = orgRes.rows[0].id;
      console.log('Using existing organization ID:', orgId);
    }

    // 2. Hash Password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash('123456', 10);

    // 3. Create User
    console.log('Creating test user...');
    const userId = crypto.randomUUID();
    await client.query(`
      INSERT INTO users (
        id, organization_id, email, password_hash, full_name, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET password_hash = $4, full_name = $5
    `, [userId, orgId, 'test@diamondkms.com', passwordHash, 'Test User', true]);

    console.log('User created: test@diamondkms.com / 123456');

  } catch (err) {
    console.error('Error creating account:', err);
  } finally {
    await client.end();
  }
}

createTestAccount();
