require('dotenv/config')
const fs = require('fs')
const { Client } = require('pg')

if (!process.env.SUPABASE_CONNECTION_STRING && fs.existsSync('../../../.env.local')) {
  try {
    const content = fs.readFileSync('../../../.env.local', 'utf-8')
    const match = content.match(/SUPABASE_CONNECTION_STRING=(.+)/)
    if (match && match[1]) process.env.SUPABASE_CONNECTION_STRING = match[1].trim()
  } catch (e) {}
}

const client = new Client({ 
  connectionString: process.env.SUPABASE_DB_URL || process.env.SUPABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
})

async function main() {
  await client.connect()
  const res = await client.query(`SELECT * FROM markets_map WHERE event_id IN (101, 102, 103)`)
  console.log('Markets:', res.rows)
  await client.end()
}

main()
