
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function checkUser() {
  const client = new Client({
    connectionString: "postgresql://diamondkms:weldnDIAMONDKMS2025@db01.weldn.ai:5432/diamondkms",
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  const email = 'test@diamondkms.com';
  console.log(`Checking user: ${email}`);
  
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (res.rows.length === 0) {
      console.log('User NOT FOUND');
      const allUsers = await client.query('SELECT email FROM users LIMIT 5');
      console.log('Sample users in DB:', allUsers.rows.map(u => u.email));
      return;
    }

    const user = res.rows[0];
    console.log('User FOUND:', {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isActive: user.is_active
    });

    if (user.password_hash) {
       console.log('Password hash exists.');
       // Verify against '123456'
       const isMatch = await bcrypt.compare('123456', user.password_hash);
       console.log(`Password '123456' matches: ${isMatch}`);
    } else {
       console.log('Password hash is MISSING.');
    }

  } catch (error) {
    console.error('Database query ERROR:', error);
  } finally {
    await client.end();
  }
}

checkUser();
