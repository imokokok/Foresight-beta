const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// 使用service key创建admin客户端
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function executeSQL() {
  try {
    console.log('尝试通过不同方法执行SQL...');
    
    // 读取SQL文件
    const sql = fs.readFileSync('create-table-final.sql', 'utf8');
    
    // 方法1: 尝试使用PostgreSQL客户端
    console.log('\n方法1: 尝试使用pg客户端...');
    try {
      const { Client } = require('pg');
      
      // 从DATABASE_URL解析连接信息
      const databaseUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_CONNECTION_STRING;
      if (!databaseUrl) {
        throw new Error('Missing SUPABASE_CONNECTION_STRING or SUPABASE_DB_URL');
      }
      
      const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      console.log('PostgreSQL连接成功');
      
      const result = await client.query(sql);
      console.log('SQL执行成功:', result);
      
      await client.end();
      
    } catch (pgError) {
      console.log('pg客户端失败:', pgError.message);
      
      // 方法2: 尝试分步执行每个SQL语句
      console.log('\n方法2: 分步执行SQL语句...');
      const statements = sql.split(';').filter(s => s.trim());
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (!statement) continue;
        
        console.log(`执行语句 ${i + 1}:`, statement.substring(0, 50) + '...');
        
        try {
          // 尝试使用不同的RPC函数名
          const rpcNames = ['sql', 'exec_sql', 'execute_sql', 'run_sql'];
          let success = false;
          
          for (const rpcName of rpcNames) {
            try {
              const { data, error } = await supabaseAdmin.rpc(rpcName, { 
                query: statement + ';'
              });
              
              if (!error) {
                console.log(`  使用 ${rpcName} 成功:`, data);
                success = true;
                break;
              } else {
                console.log(`  ${rpcName} 失败:`, error.message);
              }
            } catch (err) {
              console.log(`  ${rpcName} 异常:`, err.message);
            }
          }
          
          if (!success) {
            console.log(`  语句 ${i + 1} 执行失败`);
          }
          
        } catch (err) {
          console.log(`  语句 ${i + 1} 异常:`, err.message);
        }
      }
    }
    
    // 验证表结构
    console.log('\n验证表结构...');
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

executeSQL();
