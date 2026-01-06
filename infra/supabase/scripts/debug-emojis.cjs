const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function inspect() {
  console.log('Inspecting emojis table...');
  
  // 1. Try to select one row
  const { data, error } = await supabase.from('emojis').select('*').limit(1);
  
  if (error) {
    console.log('Error selecting from emojis:', error);
  } else {
    console.log('Select success. Data:', data);
  }

  // 2. Refresh schema cache via RPC if possible (requires a function)
  // Or we can try to "Create" the table again via SQL script execution if we had a way.
  
  console.log('Done.');
}

inspect();
