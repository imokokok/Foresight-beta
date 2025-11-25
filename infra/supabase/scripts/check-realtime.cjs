/*
  Read-only checker for Supabase Realtime setup.
  - Verifies if public.event_follows is included in publication supabase_realtime
  - Verifies replica identity setting for public.event_follows
*/

const { Client } = require('pg');
const path = require('path');

// Load .env.local
try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
} catch {}

async function main() {
  const cs = process.env.SUPABASE_CONNECTION_STRING || process.env.SUPABASE_DB_URL;
  if (!cs) {
    console.error('No SUPABASE_CONNECTION_STRING or SUPABASE_DB_URL set in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const pubSql = `
    select schemaname, tablename
    from pg_publication_tables 
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_follows'
  `;

  const repSql = `
    select c.relname, c.relreplident
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'event_follows'
  `;

  const { rows: pubRows } = await client.query(pubSql);
  const { rows: repRows } = await client.query(repSql);

  console.log('Publication includes event_follows:', pubRows);
  console.log('Replica identity:', repRows);

  await client.end();
}

main().catch(err => {
  console.error('Realtime check failed:', err.message);
  process.exit(1);
});