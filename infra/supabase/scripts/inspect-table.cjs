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
    console.log('检查event_follows表的实际结构...');
    
    // 尝试查询表的所有数据来了解结构
    console.log('尝试查询表的所有数据...');
    const { data: allData, error: allError } = await supabaseAdmin
      .from('event_follows')
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
    
    // 尝试查询字段名（统一为 user_id）
    const possibleFields = ['user_id'];
    
    for (const field of possibleFields) {
      console.log(`\n测试字段: ${field}`);
      try {
        const { data, error } = await supabaseAdmin
          .from('event_follows')
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
    
    // 尝试插入一条记录来触发错误信息
    console.log('\n尝试插入记录来获取详细错误信息...');
    const testFields = [
      { user_id: 'test', event_id: 1 },
      { user_id: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', event_id: 999999999 },
      { user_id: '0xtest000000000000000000000000000000000052', event_id: 52 }
    ];
    
    for (const testField of testFields) {
      const fieldName = Object.keys(testField)[0];
      console.log(`测试插入字段: ${fieldName}`);
      
      try {
        const { data, error } = await supabaseAdmin
          .from('event_follows')
          .insert(testField)
          .select();
        
        if (error) {
          console.log(`  ${fieldName} 插入失败:`, error.message);
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('violates foreign key constraint') && msg.includes('event_follows_event_id_fkey')) {
            console.log('  诊断: event_id 外键未能匹配 predictions(id)。可能是外键指向了错误的 schema 或旧表。');
            console.log('  修复建议: 运行 scripts/sql/fix-event-follows-fk.sql 重新建立正确外键。');
          }
        } else {
          console.log(`  ${fieldName} 插入成功！`, data);
          // 如果成功，立即删除测试数据
          await supabaseAdmin
            .from('event_follows')
            .delete()
            .or(`user_id.eq.test,user_id.eq.0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef,user_id.eq.0xtest000000000000000000000000000000000052`);
        }
      } catch (err) {
        console.log(`  ${fieldName} 插入异常:`, err.message);
      }
    }

    // 额外：确认指定 predictionId 是否存在
    const checkId = 52;
    console.log(`\n确认 predictions 中是否存在 id=${checkId} ...`);
    try {
      const { count: pidCount, error: pidErr } = await supabaseAdmin
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('id', checkId);
      if (pidErr) {
        console.log('  查询失败:', pidErr.message);
      } else {
        console.log('  count =', pidCount);
      }
    } catch (e) {
      console.log('  异常:', e.message);
    }
    
  } catch (err) {
    console.error('检查失败:', err.message);
  }
}

inspectTable();