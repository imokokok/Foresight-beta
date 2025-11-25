# Web 工作区说明

本工作区是 Next.js 15 应用，依赖 Supabase 提供数据存储与服务端写操作。

## 环境变量

在项目根 `.env.local` 中配置以下变量：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目 URL。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：前端 anon key。
- `SUPABASE_SERVICE_KEY`：服务端 Service Key（用于 `/api/*` 写操作）。
- `NEXT_PUBLIC_RELAYER_URL`：后端 relayer 地址（例如 `http://localhost:3001`）。

如需钱包连接等功能，请另行配置：

- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`：WalletConnect 项目 ID（如果使用）。

## 开发与构建

- 开发：`npm run ws:dev` 或进入 `apps/web` 目录执行 `npm run dev`。
- 构建：`npm run ws:build` 或进入 `apps/web` 目录执行 `npm run build`。
 - 并发启动前后端：`npm run ws:dev:all`（relayer 端口由根 `.env` 的 `PORT` 控制）。

## 常见问题

- 关注接口报错（`POST /api/follows 500`）：
  - 多因缺少 `event_follows(user_id, event_id)` 唯一约束或列类型不匹配；
  - 使用 `infra/supabase` 工作区的 `db:init` 或 `db:fix-follows` 修复后重试。