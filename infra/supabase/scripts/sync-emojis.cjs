const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET_NAME = 'emojis';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function syncEmojis() {
  console.log('Starting emoji sync...');

  // 1. Check if table exists
  const { error: checkError } = await supabase
    .from('emojis')
    .select('id')
    .limit(1);

  if (checkError) {
    if (checkError.message.includes('relation "emojis" does not exist') || checkError.code === '42P01' || checkError.code === 'PGRST204') {
        console.error('Error: Table "emojis" does not exist or is not accessible.');
        console.error('Please run "infra/supabase/sql/add_emoji_rewards.sql" in your Supabase SQL Editor first.');
        return;
    }
    console.error('Error checking table:', checkError);
  }

  // 2. List files in bucket
  console.log(`Listing files in bucket '${BUCKET_NAME}'...`);
  const { data: files, error: listError } = await supabase
    .storage
    .from(BUCKET_NAME)
    .list();

  if (listError) {
    console.error('Error listing files:', listError);
    return;
  }

  if (!files || files.length === 0) {
    console.log('No files found in bucket.');
    return;
  }

  console.log(`Found ${files.length} files.`);

  // 3. Process each file
  let insertedCount = 0;
  for (const file of files) {
    if (file.name === '.emptyFolderPlaceholder') continue;

    const fileName = file.name;
    // Simple name extraction: remove extension
    const name = path.parse(fileName).name; 
    
    // Get Public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    console.log(`Processing: ${name} -> ${publicUrl}`);

    // 4. Insert into database if not exists
    // Check existence by URL
    const { data: existing } = await supabase
      .from('emojis')
      .select('id')
      .eq('image_url', publicUrl)
      .maybeSingle();

    if (existing) {
      console.log(`  Skipping (already exists): ${name}`);
      continue;
    }

    const { error: insertError } = await supabase
      .from('emojis')
      .insert({
        name: name,
        image_url: publicUrl,
        rarity: 'common', // Default
        description: `Uploaded emoji: ${name}`
      });

    if (insertError) {
      console.error(`  Error inserting ${name}:`, insertError);
    } else {
      console.log(`  Inserted: ${name}`);
      insertedCount++;
    }
  }

  console.log(`Sync complete. Inserted ${insertedCount} new emojis.`);
}

syncEmojis().catch(console.error);
