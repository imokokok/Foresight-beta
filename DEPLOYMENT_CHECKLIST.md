# 🚀 Foresight 部署检查清单

在部署到生产环境前，请确保完成以下所有检查项。

## ✅ 代码修复（已完成）

- [x] 订单签名验证
- [x] JWT Session 管理
- [x] 统一 API 响应格式
- [x] 全局错误边界
- [x] 数据库物化视图
- [x] React Query 缓存
- [x] 加载骨架屏
- [x] TypeScript 类型定义

## 📋 部署前检查清单

### 1. 环境变量配置 ⚙️

- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 匿名访问密钥
- [ ] `SUPABASE_SERVICE_KEY` - 服务端密钥（敏感！）
- [ ] `JWT_SECRET` - 强随机字符串（至少32位）
- [ ] `NEXT_PUBLIC_RELAYER_URL` - Relayer 服务地址
- [ ] `SMTP_*` - 邮件服务配置（如果使用邮箱验证）

**生成 JWT_SECRET:**
\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

### 2. 依赖安装 📦

\`\`\`bash
# 在项目根目录
npm install

# 验证依赖
npm list jose @tanstack/react-query-devtools
\`\`\`

### 3. 数据库设置 🗄️

- [ ] 执行 \`create-materialized-views.sql\`
- [ ] 手动刷新物化视图: \`SELECT refresh_all_materialized_views();\`
- [ ] 验证视图数据: \`SELECT * FROM event_followers_count LIMIT 5;\`
- [ ] （可选）配置 pg_cron 定时任务

### 4. 构建测试 🏗️

\`\`\`bash
# 构建项目
npm run ws:build

# 检查构建产物
ls -la apps/web/.next/

# 本地测试生产构建
npm run ws:start
# 访问 http://localhost:3000
\`\`\`

### 5. 功能验证 🧪

#### 5.1 钱包连接
- [ ] 可以连接 MetaMask/Coinbase/OKX 等钱包
- [ ] SIWE 签名登录成功
- [ ] 登录后显示用户信息
- [ ] 检查浏览器 Cookie 中有 \`fs_session\` (JWT)

#### 5.2 订单功能
- [ ] 创建订单时进行签名验证
- [ ] 无效签名被拒绝（返回 401）
- [ ] 有效订单成功创建
- [ ] 订单列表正确显示

#### 5.3 性能测试
- [ ] 首页加载 < 3秒
- [ ] API 响应时间 < 500ms
- [ ] 物化视图查询 < 50ms
- [ ] React Query 缓存生效（Network 面板检查）

#### 5.4 错误处理
- [ ] 触发错误时显示友好错误页面
- [ ] API 错误返回统一格式
- [ ] 404 页面正常显示
- [ ] 网络断开有提示

#### 5.5 UI/UX
- [ ] 加载时显示骨架屏（不是白屏）
- [ ] 按钮有 loading 状态
- [ ] 表单有验证提示
- [ ] 移动端布局正常

### 6. 安全检查 🔒

- [ ] JWT_SECRET 不是默认值
- [ ] SUPABASE_SERVICE_KEY 不暴露到客户端
- [ ] 生产环境禁用了 React Query DevTools
- [ ] CORS 配置正确
- [ ] RLS (Row Level Security) 已启用

### 7. 监控和日志 📊

- [ ] （推荐）接入 Sentry 错误监控
- [ ] （推荐）配置日志聚合（Datadog/Logtail）
- [ ] （推荐）配置性能监控（Vercel Analytics）

### 8. 备份和回滚计划 💾

- [ ] 数据库定期备份
- [ ] Git tag 标记版本
- [ ] 准备回滚脚本
- [ ] 记录配置变更

## 📈 部署后验证

### 生产环境检查（部署后30分钟内）

- [ ] 访问首页正常加载
- [ ] 登录功能正常
- [ ] 创建订单功能正常
- [ ] 检查错误日志（无严重错误）
- [ ] 监控系统显示正常指标
- [ ] 数据库连接池稳定

### 性能监控（部署后24小时内）

- [ ] API 平均响应时间 < 500ms
- [ ] P95 响应时间 < 1s
- [ ] 数据库查询优化生效
- [ ] 缓存命中率 > 60%
- [ ] 无内存泄漏

## 🔧 快速命令参考

\`\`\`bash
# 开发环境
npm run ws:dev

# 构建
npm run ws:build

# 生产环境
npm run ws:start

# 数据库刷新物化视图（Supabase SQL Editor）
SELECT refresh_all_materialized_views();

# 查看依赖版本
npm list jose @tanstack/react-query

# 检查环境变量
node -e "console.log(process.env.JWT_SECRET ? '✅ JWT_SECRET 已设置' : '❌ 缺少 JWT_SECRET')"
\`\`\`

## ⚠️ 常见部署问题

### 问题1: 订单签名验证失败
**症状**: 所有订单创建都返回 401
**检查**: 
- 合约地址是否正确
- chainId 是否匹配
- 签名格式是否正确

### 问题2: JWT Token 无效
**症状**: 登录后立即退出
**检查**:
- JWT_SECRET 是否配置
- Cookie 是否被清除
- 时区设置是否正确

### 问题3: 物化视图数据为空
**症状**: 关注数都是 0
**解决**: \`REFRESH MATERIALIZED VIEW CONCURRENTLY event_followers_count;\`

### 问题4: 构建失败
**症状**: \`npm run build\` 报错
**检查**:
- 所有依赖是否安装
- TypeScript 错误是否修复
- 环境变量是否配置

## 📞 紧急联系方式

如果部署遇到严重问题：

1. **立即回滚**: 使用上一个稳定版本
2. **检查日志**: 查看错误详情
3. **联系团队**: 技术支持
4. **提交 Issue**: GitHub Issues

---

**部署完成后，在此打勾 ✅**

- [ ] 我已完成所有检查项
- [ ] 我已验证关键功能
- [ ] 我已配置监控告警
- [ ] 我已准备回滚方案

**部署日期**: __________  
**部署人员**: __________  
**版本号**: __________

🎉 **祝部署顺利！**

