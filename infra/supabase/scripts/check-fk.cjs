const { Client } = require('pg');

// 直接复用项目中的 Supabase 连接串（与 supabase-direct.cjs 保持一致）
const databaseUrl = 'postgresql://postgres.qhllkgbddesrbhvjzfud:Foresight2024!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('[DB] 连接成功');

    // 查询 event_follows 的外键约束
    const fkSql = `
      SELECT
        tc.constraint_name,
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='event_follows' AND tc.table_schema='public';
    `;
    const fkRes = await client.query(fkSql);
    if (fkRes.rows.length === 0) {
      console.log('[FK] 未发现任何外键约束在 public.event_follows 上');
    } else {
      console.log(`[FK] 发现 ${fkRes.rows.length} 条约束：`);
      for (const r of fkRes.rows) {
        console.log(` - ${r.constraint_name}: ${r.table_schema}.${r.table_name}(${r.column_name}) → ${r.foreign_table_schema}.${r.foreign_table_name}(${r.foreign_column_name})`);
      }
    }

    // 使用 pg_catalog 获取约束定义文本（便于确认 ON DELETE CASCADE 等细节）
    const defSql = `
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'public.event_follows'::regclass AND contype = 'f';
    `;
    const defRes = await client.query(defSql);
    if (defRes.rows.length) {
      console.log('[FK DEF] 约束定义：');
      for (const r of defRes.rows) {
        console.log(` - ${r.conname}: ${r.def}`);
      }
    }

    // 确认两张表存在及关键列类型
    const colsSql = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN ('event_follows','predictions') AND column_name IN ('event_id','id','user_id');
    `;
    const colsRes = await client.query(colsSql);
    console.log('[TABLE COLS] 关键列类型：');
    for (const r of colsRes.rows) {
      console.log(` - ${r.table_name}.${r.column_name}: ${r.data_type}`);
    }

    // 进一步验证：若存在 FK，则尝试插入一个不存在的 event_id 以验证约束拦截
    // 注意：若不存在约束，该插入会成功；若存在约束且 predictions 中无对应 id，则会失败
    const testEid = 999999999; // 高位不存在的 id
    console.log('[FK TEST] 尝试插入不存在的 event_id 以验证外键是否生效...');
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO public.event_follows (user_id, event_id) VALUES ($1, $2)', ['0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', testEid]);
      await client.query('ROLLBACK');
      console.log(' - 插入成功（已回滚）：可能未设置外键或 predictions 表存在该 id');
    } catch (e) {
      console.log(' - 插入失败（预期外键拦截）：', e.message);
      try { await client.query('ROLLBACK'); } catch {}
    }

  } catch (e) {
    console.error('检查失败：', e.message);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();