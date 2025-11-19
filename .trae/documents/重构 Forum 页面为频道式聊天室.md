## 目标
- 将现有“论坛/提案”页重构为 Discord 风格的频道式聊天室。
- 每个预测事件自动对应一个聊天室（以事件 ID 作为房间标识）。
- 左侧列出全部聊天室；主区显示当前房间聊天；底部输入框发送消息。

## 页面结构
1. 路由与命名：保留 `href="/forum"`，重命名页面语义为“Forum（频道）”。现有链接位于 TopNavBar（src/components/TopNavBar.tsx）。
2. 组件布局（apps/web/src/app/forum/page.tsx）：
   - 左侧导航（频道列表）：事件列表（标题 + 分类 + 状态）作为可点击房间；支持搜索与滚动。
   - 主内容区：当前房间的聊天消息流（SSE 实时）；消息按时间排序，显示昵称或钱包地址前后缀。
   - 底部输入框：文本框 + 发送按钮（Enter 发送，Shift+Enter 换行）。
   - 页头保留 TopNavBar；移除当前页内的“即时聊天模块”与“提案/公告”主体，必要时将其迁移至次级 Tab（例如“提案”子页）。

## 聊天室模型
- 房间定义：以预测事件 `id` 为房间 ID；房间名显示事件标题。
- 自动生成：无需显式建房表；通过读取 `predictions` 列表直接展示频道；首次发送消息即开始持久化。
- 数据存储（开发/无后端表模式）：沿用本地文件存储 `.data/event_chat_messages.json`。
  - 读写代码：src/lib/localChatStore.ts（addMessage、getMessagesByEvent）。

## 后端接口
- 事件列表：`GET /api/predictions`（src/app/api/predictions/route.ts）。返回 `data: [{ id, title, category, ...}]`。
- 发送消息：`POST /api/chat`（src/app/api/chat/route.ts）。
  - 请求体：`{ eventId, content, walletAddress }`
  - 持久化：调用 `addMessage` 写入本地存储。
- 消息流（SSE）：`GET /api/chat/stream?eventId=...`（src/app/api/chat/stream/route.ts）。
  - 周期 `poll` 拉取 `getMessagesByEvent(eventId)` 推送到前端。

## 前端交互细节
- 频道列表：
  - 首屏加载 `GET /api/predictions`，按 `created_at` 或 `followers_count` 排序；提供搜索框过滤标题。
  - 点击频道切换 `selectedEventId`，右侧主区切换到对应聊天室。
- 聊天消息：
  - 打开房间后建立 SSE 连接，URL：`/api/chat/stream?eventId=<id>`。
  - 消息渲染采用简单气泡样式；长文本自动换行；时间戳显示本地时间。
- 发送消息：
  - 从 WalletContext 读取 `account`；未连接时提示连接钱包并进行 SIWE（src/contexts/WalletContext.tsx:704 起）。
  - 调用 `POST /api/chat` 发送；成功后前端清空输入框，消息将通过 SSE 回流。

## 迁移与移除
- 移除现有“即时聊天功能模块”在本页的呈现；以频道式布局替换。
- 原“提案/公告”模块（apps/web/src/app/forum/page.tsx:126-148）的内容：
  - 可迁至 `/forum/proposals` 子页或保留为次级 Tab，避免与频道 UI 混杂。

## 技术实现要求（按个人开发者可控条件）
- 框架：Next.js + React（现有版本 15.5.4）。
- 实时：服务端事件（SSE）+ 轮询保障（已在后端实现）。
- 存储：开发模式使用本地文件；后续可替换为 Supabase 表（如 `chat_messages(event_id, user_id, content, created_at)`）。
- 会话：钱包签名登录（SIWE）用于识别用户地址（src/app/api/siwe/verify/route.ts）。
- 安全：限制消息长度（后端已 `slice(0, 2000)`），必要时增加简单的频率限制与关键词过滤。

## 测试要求（按个人开发者场景）
1. 手动联调：
   - 打开 `/forum`，看到左侧事件频道列表；点击频道后主区出现聊天历史（若无则显示占位）。
   - 连接钱包并完成 SIWE；在底部输入框发送消息，SSE 收到并渲染；切换频道后只显示对应事件的消息。
   - 搜索框过滤频道；大规模频道列表滚动性能正常。
2. 端到端验证：
   - 无钱包：发送按钮提示需要连接钱包。
   - SSE 断线：前端自动重连或回退到 1s 轮询（后端已轮询推送）。
   - 多房间切换：快速切换不丢消息，SSE 正确关闭旧连接。
3. 可选自动化：
   - 添加简单脚本向 `.data/event_chat_messages.json` 预置若干事件消息，验证列表与渲染。
   - 针对 `/api/chat` 与 `/api/chat/stream` 的最小集成测试（在开发模式）。

## 挂接点与代码参考
- 频道页入口：apps/web/src/app/forum/page.tsx（现有“论坛/提案”UI）
- 顶部导航链接：src/components/TopNavBar.tsx（`href="/forum"`）
- 聊天发送接口：apps/web/src/app/api/chat/route.ts（POST 实现）
- 聊天实时流：apps/web/src/app/api/chat/stream/route.ts（SSE 实现）
- 本地消息存储：apps/web/src/lib/localChatStore.ts（addMessage/getMessagesByEvent）
- SIWE 会话：apps/web/src/app/api/siwe/verify/route.ts:35-44

## 迭代与上线
- 第一步：替换 `/forum` 页面为频道布局（保留“提案”为子页）。
- 第二步：打通钱包登录发送消息；接入 SSE。
- 第三步：优化频道列表加载与搜索；完成样式与动画。
- 第四步（可选）：将消息存储迁移至 Supabase，支持多实例与持久化备份。