const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qhllkgbddesrbhvjzfud.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_VnrRa68cNTWbwvmkYQjXJw_lM5LI68r'; 

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
