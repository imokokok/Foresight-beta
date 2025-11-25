# Supabase 管理与初始化

本工作区集中维护 Supabase 的数据库脚本与管理工具。用于初始化表结构、修复结构差异、启用 RLS，以及进行简单的读写验证。

## 环境变量

- `SUPABASE_DB_URL` 或 `SUPABASE_CONNECTION_STRING`：Postgres 直连连接字符串（必需）。在 Supabase 控制台获取：Project Settings → Database → Connection string（选择 `Node` 或 `psql`，复制 `postgresql://...`）。脚本会尝试从当前目录与项目根目录的 `.env` / `.env.local` 读取这两个变量。
- `NEXT_PUBLIC_SUPABASE_URL`：前端使用的项目 URL（可选，用于脚本联调）。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：前端使用的 anon key（可选，用于脚本联调）。
- `SUPABASE_SERVICE_KEY`：服务端使用的 service key（可选，供 `apps/web` 的服务端 API 使用）。

建议在本目录创建 `.env`（或在项目根 `.env.local`）并填入 `SUPABASE_DB_URL` 或 `SUPABASE_CONNECTION_STRING`，避免泄露到前端。

## 常用脚本

在项目根目录执行：

- 初始化数据库结构（表、索引、示例数据）：
  - `npm run -w infra/supabase db:init`
  - 对应 SQL：`infra/supabase/sql/supabase-init.sql`

- 修复 `event_follows` 表的唯一约束与类型（解决 `/api/follows` 500 错误）：
  - `npm run -w infra/supabase db:fix-follows`
  - 动作：删除历史外键、将 `user_id` 改为 `TEXT`、创建唯一索引 `(user_id, event_id)`。
  - 仅用 SQL 的替代方式：
    - `npm run -w infra/supabase db:fix-follows:sql`
    - 或 `psql -f infra/supabase/sql/fix-event-follows.sql`（需提供连接参数）

- 启用 `event_follows` 的 RLS（行级安全）：
  - `npm run -w infra/supabase db:enable-rls`

- 简单写入验证：
  - `npm run -w infra/supabase db:follows:insert`
  - 依赖 `SUPABASE_DB_URL`，可通过 `TEST_EVENT_ID` 与 `TEST_USER_ID` 参数覆盖测试数据。

## 运行前置条件

- 确保 `.env.local` 中的 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 与当前数据库一致。
- `apps/web` 的服务端 API 需要 `SUPABASE_SERVICE_KEY` 才能进行服务端写操作。
- 本目录的管理脚本需要 `SUPABASE_DB_URL` 或 `SUPABASE_CONNECTION_STRING`；该值不会用于前端，仅在管理时使用。

### 使用 psql 的手动修复示例

如果你更习惯使用 `psql`，或直连 DNS 受限，可按如下方式运行（注意将 `%40` 等 URL 编码还原为密码明文，或提前设置环境变量 `PGPASSWORD`）：

- PowerShell 设置密码：
  - `$env:PGPASSWORD = '<你的明文密码>'`
- 执行修复：
  - `psql -h <你的db主机> -p 5432 -d postgres -U postgres -f infra/supabase/sql/fix-event-follows.sql`

## 故障与修复

- 看到 `POST /api/follows` 的错误 `no unique or exclusion constraint matching the ON CONFLICT specification`：
  - 运行 `npm run -w infra/supabase db:fix-follows` 或执行 `infra/supabase/sql/supabase-init.sql` 后半部分的迁移片段；
  - 该脚本将确保 `event_follows(user_id, event_id)` 的唯一索引存在，且 `user_id` 为 `TEXT`。

- 如果出现外键约束错误（`event_id` 指向错误表或不存在）：
  - 确认 `event_follows.event_id` 的外键指向 `public.predictions(id)`；如不一致，参照 `infra/supabase/sql/supabase-init.sql` 修复。

## 验证方法

- 前端运行：`npm run ws:dev`（或在 `apps/web` 目录 `npm run dev`）。
- 执行一次 `db:init` 后，访问页面进行关注操作；服务端将使用 `ON CONFLICT (user_id, event_id)` 去重。