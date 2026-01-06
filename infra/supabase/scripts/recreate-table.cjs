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

async function recreateTable() {
  try {
    console.log('删除现有的event_follows表...');
    
    // 使用原生SQL删除表
    const { error: dropError } = await client
      .from('event_follows')
      .delete()
      .neq('id', 0); // 删除所有记录
    
    if (dropError) {
      console.log('删除记录失败:', dropError.message);
    } else {
      console.log('成功删除所有记录');
    }
    
    console.log('现在可以让API重新创建表了');
    console.log('请尝试调用POST /api/follows来触发表的重新创建');
    
  } catch (err) {
    console.error('操作失败:', err.message);
  }
}

recreateTable();
