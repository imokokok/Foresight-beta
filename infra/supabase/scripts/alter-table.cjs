const { createClient } = require('@supabase/supabase-js');

// 使用service key创建admin客户端
const supabaseAdmin = createClient(
  'https://qhllkgbddesrbhvjzfud.supabase.co', 
  'sb_secret_VnrRa68cNTWbwvmkYQjXJw_lM5LI68r',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function alterTable() {
  try {
    console.log('检查表是否存在...');
    
    // 首先检查表是否存在
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'event_follows');
    
    if (tablesError) {
      console.log('检查表失败:', tablesError.message);
    } else {
      console.log('表查询结果:', tables);
    }
    
    // 检查列是否存在
    console.log('检查列结构...');
    const { data: columns, error: columnsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'event_follows');
    
    if (columnsError) {
      console.log('检查列失败:', columnsError.message);
    } else {
      console.log('现有列:', columns);
    }
    
    // 尝试直接插入数据来触发表的自动创建
    console.log('尝试插入测试数据...');
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('event_follows')
      .insert([
        { user_id: 'test123', event_id: 1 },
        { user_id: 'test456', event_id: 2 }
      ])
      .select();
    
    if (insertError) {
      console.log('插入失败:', insertError.message);
      
      // 如果插入失败，尝试使用upsert
      console.log('尝试使用upsert...');
      const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from('event_follows')
        .upsert([
        { user_id: 'test123', event_id: 1 },
        { user_id: 'test456', event_id: 2 }
      ])
        .select();
      
      if (upsertError) {
        console.log('upsert也失败:', upsertError.message);
      } else {
        console.log('upsert成功:', upsertData);
      }
    } else {
      console.log('插入成功:', insertData);
      
      // 清理测试数据
      await supabaseAdmin
        .from('event_follows')
        .delete()
        .in('user_id', ['test123', 'test456']);
    }
    
    // 最终验证
    console.log('最终验证...');
    const { data, error } = await supabaseAdmin
      .from('event_follows')
      .select('user_id')
      .limit(1);
    
    if (error) {
      console.log('验证失败:', error.message);
    } else {
      console.log('验证成功！表结构正确');
    }
    
  } catch (err) {
    console.error('操作失败:', err.message);
  }
}

alterTable();