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

async function testUserWallet() {
  try {
    console.log('测试使用user_id字段的表操作...');
    
    // 尝试插入测试数据
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
      
      // 检查是否是列不存在的错误
      if (insertError.message.includes('user_id')) {
        console.log('user_id列不存在，需要创建表');
      }
    } else {
      console.log('插入成功:', insertData);
      
      // 测试查询
      console.log('测试查询...');
      const { data: queryData, error: queryError } = await supabaseAdmin
        .from('event_follows')
        .select('*')
        .eq('user_id', 'test123');
      
      if (queryError) {
        console.log('查询失败:', queryError.message);
      } else {
        console.log('查询成功:', queryData);
      }
      
      // 清理测试数据
      console.log('清理测试数据...');
      await supabaseAdmin
        .from('event_follows')
        .delete()
        .in('user_id', ['test123', 'test456']);
      
      console.log('测试数据已清理');
    }
    
    // 最终验证
    console.log('最终验证表结构...');
    const { data, error } = await supabaseAdmin
      .from('event_follows')
      .select('user_id')
      .limit(1);
    
    if (error) {
      console.log('验证失败:', error.message);
      if (error.message.includes('user_id')) {
        console.log('确认：user_id列不存在');
      }
    } else {
      console.log('验证成功！user_id字段可用');
    }
    
  } catch (err) {
    console.error('操作失败:', err.message);
  }
}

testUserWallet();