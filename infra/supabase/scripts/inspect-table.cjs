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

async function inspectTable() {
  try {
    console.log('检查orders表的实际结构...');
    
    console.log('尝试查询表的所有数据...');
    const { data: allData, error: allError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .limit(5);
    
    if (allError) {
      console.log('查询所有数据失败:', allError.message);
    } else {
      console.log('表中的数据:', allData);
      if (allData && allData.length > 0) {
        console.log('第一行数据的字段:', Object.keys(allData[0]));
      } else {
        console.log('表为空，无法确定字段结构');
      }
    }
    
    const possibleFields = ['market_key', 'chain_id', 'verifying_contract', 'maker_address', 'status'];
    
    for (const field of possibleFields) {
      console.log(`\n测试字段: ${field}`);
      try {
        const { data, error } = await supabaseAdmin
          .from('orders')
          .select(field)
          .limit(1);
        
        if (error) {
          console.log(`  ${field} 不存在:`, error.message);
        } else {
          console.log(`  ${field} 存在！`);
        }
      } catch (err) {
        console.log(`  ${field} 测试异常:`, err.message);
      }
    }
    
  } catch (err) {
    console.error('检查失败:', err.message);
  }
}

inspectTable();
