const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env')
let databaseUrl = ''
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const splitIndex = trimmed.indexOf('=')
      const key = trimmed.substring(0, splitIndex).trim()
      const value = trimmed.substring(splitIndex + 1).trim()
      const cleanValue = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
      if (key === 'DATABASE_URL') databaseUrl = cleanValue
    }
  }
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found in .env')
  process.exit(1)
}

const client = new Client({
  connectionString: databaseUrl,
})

async function main() {
  await client.connect()
  const email = 'test@diamondkms.com'

  try {
    // 1. Find user
    const userRes = await client.query('SELECT id, organization_id, full_name FROM users WHERE email = $1', [email])
    if (userRes.rowCount === 0) {
      console.log(`User with email ${email} not found.`)
      return
    }
    const user = userRes.rows[0]
    console.log(`Found user: ${user.full_name} (ID: ${user.id})`)

    // 2. Check divisions
    const divRes = await client.query('SELECT id, division_id, role FROM user_divisions WHERE user_id = $1', [user.id])
    if (divRes.rowCount > 0) {
      console.log(`Updating ${divRes.rowCount} division roles to SUPER_ADMIN...`)
      await client.query("UPDATE user_divisions SET role = 'SUPER_ADMIN' WHERE user_id = $1", [user.id])
      console.log('Success: Role updated to SUPER_ADMIN for all divisions.')
    } else {
      console.log('User has no divisions. Finding a division to assign...')
      const orgDivRes = await client.query('SELECT id FROM divisions WHERE organization_id = $1 LIMIT 1', [user.organization_id])
      
      let divisionId
      if (orgDivRes.rowCount > 0) {
        divisionId = orgDivRes.rows[0].id
        console.log(`Found division ID: ${divisionId}`)
      } else {
        console.log('No divisions found for organization. Creating a default division...')
        const newDivRes = await client.query(
          "INSERT INTO divisions (id, organization_id, name, created_at) VALUES (gen_random_uuid(), $1, 'Main Division', NOW()) RETURNING id",
          [user.organization_id]
        )
        divisionId = newDivRes.rows[0].id
        console.log(`Created new division ID: ${divisionId}`)
      }

      await client.query(
        "INSERT INTO user_divisions (id, user_id, division_id, role, is_primary) VALUES (gen_random_uuid(), $1, $2, 'SUPER_ADMIN', true)",
        [user.id, divisionId]
      )
      console.log('Success: Added user to division as SUPER_ADMIN.')
    }

  } catch (err) {
    console.error('Database error:', err)
  } finally {
    await client.end()
  }
}

main()
