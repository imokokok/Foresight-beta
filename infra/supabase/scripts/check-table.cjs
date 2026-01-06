const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const client = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY
);

async function checkAndFixTable() {
  try {
    console.log('检查event_follows表结构...');
    
    // 尝试查询表结构
    const { data, error } = await client
      .from('event_follows')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('查询错误:', error.message);
      return;
    }
    
    console.log('表存在，数据:', data);
    
    // 检查是否有user_id字段
    const { data: testData, error: testError } = await client
      .from('event_follows')
      .select('user_id')
      .limit(1);
    
    if (testError) {
      console.log('user_id字段不存在，需要添加:', testError.message);
      
      // 尝试添加user_id字段
      const { error: alterError } = await client.rpc('execute_sql', {
        sql: 'ALTER TABLE event_follows ADD COLUMN IF NOT EXISTS user_id TEXT;'
      });
      
      if (alterError) {
        console.log('添加字段失败:', alterError.message);
      } else {
        console.log('成功添加user_id字段');
      }
    } else {
      console.log('user_id字段已存在');
    }
    
  } catch (err) {
    console.error('检查失败:', err.message);
  }
}

checkAndFixTable();
