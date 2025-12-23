# 🔮 Foresight - 去中心化预测市场平台

> 基于区块链与智能合约的预测市场基础设施，面向真实事件、链上资产和社区情绪，提供安全、透明、公平的预测与交易体验。

[![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

---

## ✨ 产品特性（站在用户视角）

- 🎯 多类型预测市场：支持二元事件、多选事件等不同结构的预测市场
- 💰 链上真实结算：预测以智能合约结算，可验证、可追溯
- 👛 多钱包接入：支持 MetaMask、Coinbase Wallet、WalletConnect 等主流钱包
- 💬 事件内讨论区：每个预测都有独立讨论区与实时聊天，促进观点碰撞
- 🏆 预测者排行榜：按收益率和命中率展示顶级预测者，强化社区声誉体系
- 🌍 中英文双语体验：全站支持中文/英文，URL 级国际化路由
- 📱 移动端优先设计：专门的底部导航、汉堡菜单和下拉刷新体验
- ⚡ 性能指标可量化：首屏加载 < 2s，LCP < 2.5s，滚动帧率接近 60fps
- 📊 内建性能监控面板：内置 Web Vitals 与自建性能数据上报与查看能力

更多关于三阶段优化与 ROI 的详细数据，请参见 [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) 与 [OPTIMIZATION_REPORTS.md](./OPTIMIZATION_REPORTS.md)。

---

## 🧩 架构总览

Foresight 采用 Monorepo 结构，主要模块包括：

- `apps/web`：Next.js Web 前端应用
- `packages/contracts`：Solidity 智能合约与 Hardhat 工程
- `services/relayer`：简化版 ERC-4337 Relayer/Bundler
- `infra/supabase`：Supabase 数据库 schema 与管理脚本
- `scripts`：合约部署与链上工具脚本

目标是：**让用户体验接近 Web2 产品，但由 Web3 基础设施提供安全与结算。**

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm
- Git

### 克隆与安装

```bash
git clone https://github.com/Foresight-builder/Foresight-beta.git
cd Foresight-beta
npm install
```

### 配置环境变量

```bash
cp .env.example .env.local
```

关键变量示例：

- `NEXT_PUBLIC_APP_URL`：前端站点 URL（例如 `http://localhost:3000`）
- `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `NEXT_PUBLIC_RELAYER_URL`
- 区块链接口与合约相关变量（如 `USDC_ADDRESS_AMOY`、`COLLATERAL_TOKEN_ADDRESS`）

数据库与 Supabase 相关变量的完整说明，见 `infra/supabase/README.md`。

### 启动开发环境

仅启动 Web：

```bash
npm run ws:dev
```

或进入子目录：

```bash
cd apps/web
npm run dev
```

同时启动 Web + Relayer：

```bash
cd /path/to/Foresight-beta
npm run ws:dev:all
```

默认访问：<http://localhost:3000>

---

## 📚 文档导航

核心入口：

- [DOC_INDEX.md](./DOC_INDEX.md)：完整文档索引
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)：项目优化与 ROI 总结
- [QUICK_START.md](./QUICK_START.md)：新工具与常用能力快速上手
- [DOCS.md](./DOCS.md)：组件、Hooks、API、数据库文档
- [ADVANCED_FEATURES_GUIDE.md](./ADVANCED_FEATURES_GUIDE.md)：测试、国际化、Sentry 等高级能力
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)：生产部署清单

优化与规划相关：

- [OPTIMIZATION_REPORTS.md](./OPTIMIZATION_REPORTS.md)
- [PHASE2_FINAL_REPORT.md](./PHASE2_FINAL_REPORT.md)
- [PHASE3_TIER1_COMPLETE.md](./PHASE3_TIER1_COMPLETE.md)
- [NEXT_STEPS.md](./NEXT_STEPS.md)

> 原 README 中指向的 `PHASE3_PLAN.md` 已被上述文档覆盖，此处不再引用该文件。

---

## 🏗️ 技术栈

### 前端（apps/web）

- Next.js 15.5.4（App Router）
- React 19 + TypeScript
- Tailwind CSS + Framer Motion
- React Query + 自定义 Context（Auth、Wallet、UserProfile）
- React Hook Form
- next-intl 多语言

### 区块链与钱包

- Ethers.js
- 支持多网络（Polygon 主网、Amoy 测试网、Sepolia 等）
- EIP-4361 / Sign-In with Ethereum (SIWE)
- 扩展型预测市场合约（`Foresight` + 模板市场）

### 后端与数据

- Supabase (PostgreSQL)
- Supabase Realtime + Storage
- 行级安全（RLS）、索引与物化视图

### 工具链

- Web Vitals + 自建性能上报与可视化
- Vercel 部署
- GitHub Actions CI/CD（测试与构建）

---

```bash
Foresight-beta/
├── apps/
│   └── web/                    # Next.js 主应用
│       ├── src/
│       │   ├── app/            # App Router 页面 (trending, prediction, forum, admin 等)
│       │   ├── components/     # UI、骨架屏、导航、弹窗等
│       │   ├── contexts/       # Auth、Wallet、UserProfile 等上下文
│       │   ├── hooks/          # useInfiniteScroll、usePersistedState 等
│       │   ├── lib/            # apiWithFeedback、security、rateLimit、i18n 等工具
│       │   └── test/           # 前端测试工具与 Mock
│       └── public/             # 静态资源与 PWA 文件
├── packages/
│   └── contracts/              # 智能合约与 Hardhat
├── services/
│   └── relayer/                # 中继服务（ERC-4337 风格）
├── infra/
│   └── supabase/               # 数据库脚本与管理工具
├── scripts/                    # 部署与链上工具脚本
├── DOC_INDEX.md                # 文档导航
├── PROJECT_SUMMARY.md          # 项目总结
├── QUICK_START.md              # 快速开始
└── DOCS.md                     # 开发文档
```

---

## 🎨 核心功能与场景

### 1. 预测市场

- 创建和参与预测事件
- 二元和多元选项支持
- 实时赔率更新
- 自动结算

### 2. 钱包集成

- MetaMask
- Coinbase Wallet
- WalletConnect
- Sign-In with Ethereum (SIWE)

### 3. 社交功能

- 实时聊天
- 讨论论坛
- 用户资料
- 排行榜

### 4. 移动端

- 响应式设计
- 汉堡菜单
- 底部导航
- 下拉刷新
- 触摸优化

### 5. 性能监控与运营

- Web Vitals 收集与上报
- 管理端性能仪表板
- 实时查看关键指标与历史趋势
- 结合优化报告评估改动效果

更多使用与最佳实践，可结合：

- `apps/web/src/app/admin/performance/page.tsx`
- `lib/performance.ts`
- `OPTIMIZATION_REPORTS.md`

---

## 🧪 测试与质量保障

### 合约测试（Hardhat）

```bash
npm run hardhat:test
```

### 前端测试（Vitest）

```bash
cd apps/web
npm run test
```

关于覆盖率目标和目录结构，请查看 [ADVANCED_FEATURES_GUIDE.md](./ADVANCED_FEATURES_GUIDE.md)。

---

## 🤝 贡献

欢迎通过 Issue 或 Pull Request 参与共建：

1. Fork 本仓库
2. 创建特性分支
3. 提交变更并描述设计思路
4. 提交 PR 并关联相关 Issue（如有）

---

## 📝 许可证

本项目采用 MIT 许可证，详情见 [LICENSE](./LICENSE)。

---

## 📡 联系我们

- Website: <https://foresight.market>
- Twitter: `@ForesightMarket`
- Discord: <https://discord.gg/foresight>
- Email: `hello@foresight.market`

---

## ⭐ 支持项目

如果这个项目对你有帮助，欢迎：

- 在 GitHub 上点一个 Star
- 与团队或朋友分享
- 在 Issue 中告诉我们你的使用场景与建议

---

**最后更新**: 2024-12-19
