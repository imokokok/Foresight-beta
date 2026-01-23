# ADR-001：采用 Next.js App Router 架构

## 状态

已接受

## 日期

2024-01-01

## 背景

项目初期需要选择一个现代的 React 框架来构建前端应用。Next.js 13 引入了全新的 App Router 架构，提供了一系列现代特性支持服务端渲染和 React Server Components。

主要考虑的选择包括：
- Next.js Pages Router（传统架构）
- Next.js App Router（新架构）
- Remix（全栈框架）
- Vite + React SPA

## 决策

采用 Next.js App Router 架构。

## 原因

1. **服务端组件支持**：App Router 原生支持 React Server Components，可以在服务端渲染组件减少客户端 bundle 大小，提高首屏加载性能。

2. **流式渲染**：支持流式渲染，可以逐步加载页面内容，提升用户感知性能。

3. **布局系统**：嵌套布局系统简化了共享 UI 和页面特定逻辑的管理。

4. **服务端动作**：可以使用 `use server` 声明服务端 action，简化数据获取和表单处理。

5. **生态系统**：Next.js 拥有最大的 React 生态系统，文档完善，社区活跃。

## 替代方案

- **Remix**：全栈框架，loader/action 模式优秀，但生态系统相对较小
- **Vite + SPA**：简单直接，但缺乏服务端渲染能力，不适合需要 SEO 的场景

## 后果

### 正面

- 更好的首屏加载性能
- 更小的客户端 bundle
- 更简单的数据获取模式
- 更好的 SEO 支持

### 负面

- 学习曲线较陡（需要理解 Server Components）
- 部分第三方库可能不兼容
- 部署配置相对复杂
