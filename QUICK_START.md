# 🚀 Foresight 快速开始指南

## 新工具使用指南

### 1. Toast 通知系统

替代所有 `alert()` 使用：

```typescript
import { toast } from "@/lib/toast";

// ✅ 成功提示
toast.success("操作成功");

// ❌ 错误提示
toast.error("操作失败", "网络连接不稳定");

// ⚠️ 警告提示
toast.warning("注意", "此操作无法撤销");

// ℹ️ 信息提示
toast.info("提示", "数据已同步");

// 🔄 异步操作
toast.promise(fetchData(), {
  loading: "加载中...",
  success: "加载成功！",
  error: "加载失败",
});
```

### 2. 骨架屏组件

在数据加载时使用：

```typescript
import { EventCardSkeleton } from "@/components/ui/Skeleton";

{loading ? (
  <EventCardSkeleton />
) : (
  <EventCard data={data} />
)}
```

### 3. 输入验证与 XSS 防护

```typescript
import { validateAndSanitize, sanitizeText } from "@/lib/security";

// 验证用户输入
const result = validateAndSanitize(userInput, {
  type: "text",
  required: true,
  maxLength: 200,
});

if (!result.valid) {
  toast.error("输入错误", result.error);
  return;
}

// 清理用户输入
const cleanText = sanitizeText(dirtyInput);
```

### 4. Rate Limiting（API Route）

```typescript
import { withRateLimit, rateLimitPresets } from "@/lib/rateLimit";

export const POST = withRateLimit(
  async (req) => {
    // 处理请求...
  },
  rateLimitPresets.normal // 1分钟60次
);
```

### 5. 可访问性 Hooks

```typescript
import { useFocusTrap, useEscapeKey } from "@/hooks/useAccessibility";

function Modal({ onClose }) {
  const containerRef = useFocusTrap(true); // 焦点陷阱
  useEscapeKey(onClose); // ESC 键关闭

  return <div ref={containerRef}>...</div>;
}
```

---

## 代码风格建议

### ✅ 推荐做法

```typescript
// 1. 使用 Toast 而不是 alert
toast.error("创建失败", "请检查网络连接");

// 2. 加载状态使用骨架屏
{loading ? <Skeleton /> : <Content />}

// 3. 验证用户输入
const { valid, value, error } = validateAndSanitize(input, { type: "text" });

// 4. 移动端适配
<div className="mobile-safe-padding">...</div>

// 5. 可访问性
<button aria-label="关闭对话框" onClick={onClose}>
  <X />
</button>
```

### ❌ 避免做法

```typescript
// ❌ 不要使用 alert
alert("操作失败");

// ❌ 不要显示简单的 Loading 文字
{loading && <div>Loading...</div>}

// ❌ 不要直接使用未验证的用户输入
await db.insert(userInput); // 危险！

// ❌ 不要忘记移动端适配
<button style={{ minHeight: "20px" }}>...</button>

// ❌ 不要忽略可访问性
<div onClick={handleClick}>点击</div> // 应该用 button
```

---

## 常见问题

### Q: Toast 不显示？

**A:** 确保在 `layout.tsx` 中已添加 `<ToastProvider />`

### Q: 骨架屏样式不对？

**A:** 检查是否导入了正确的 Skeleton 组件，确认 Tailwind CSS 已正确配置

### Q: Rate Limiting 在开发环境不生效？

**A:** Rate Limiting 基于内存存储，开发环境重启会重置计数

### Q: 移动端底部被遮挡？

**A:** 使用 `env(safe-area-inset-bottom)` 或添加 `.mobile-safe-padding` 类

---

## 下一步

1. 阅读 [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md) 了解详细优化内容
2. 查看各工具文件的 JSDoc 注释获取更多 API 信息
3. 运行 `npm run dev` 启动开发服务器体验新特性

---

**更新日期：** 2025-12-18  
**版本：** v1.0.0
