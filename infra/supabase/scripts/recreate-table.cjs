const { createClient } = require('@supabase/supabase-js');

const client = createClient(
  'https://qhllkgbddesrbhvjzfud.supabase.co', 
  'sb_secret_VnrRa68cNTWbwvmkYQjXJw_lM5LI68r'
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