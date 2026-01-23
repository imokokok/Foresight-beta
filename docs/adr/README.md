# 架构决策记录（ADR）

本目录记录了 Foresight 项目中的重要技术架构决策。

## ADR 模板

每个 ADR 文件应包含以下部分：
- **状态**：提案（Proposed）、已接受（Accepted）、已弃用（Deprecated）、已替换（Superseded）
- **背景**：描述做出决策的上下文和问题
- **决策**：描述最终做出的决策
- **后果**：描述决策的结果，包括正面和负面的影响
- **替代方案**：列出考虑的替代方案及其优缺点

## 目录

| ADR 编号 | 标题 | 状态 | 日期 |
|----------|------|------|------|
| [001](adr/001-use-nextjs-app-router.md) | 采用 Next.js App Router 架构 | 已接受 | 2024-01-01 |
| [002](adr/002-use-react-query-for-state.md) | 使用 React Query 管理服务端状态 | 已接受 | 2024-01-01 |
| [003](adr/003-offchain-matching-architecture.md) | 采用链下撮合 + 链上结算架构 | 已接受 | 2024-01-01 |
| [004](adr/004-use-monorepo-structure.md) | 采用 Monorepo 管理多项目 | 已接受 | 2024-01-01 |
