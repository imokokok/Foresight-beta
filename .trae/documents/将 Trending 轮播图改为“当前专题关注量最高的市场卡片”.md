## 需求理解
- 目标：将 Trending 页英雄区的轮动图（当前使用静态 `heroEvents`）改为从下方市场卡片数据中选取“关注量最高”的事件展示。
- 规则：
  - 先按 `followers_count` 降序选取；
  - 若关注量相同，选取“截止日期更靠近现在”的事件（仅考虑未到期，过期的排后）。
  - 当选择了某个专题（分类）时，范围限定为当前专题；否则使用全部已展示事件。

## 数据来源与现状
- 市场卡片数据：`sortedEvents` 由 `displayEvents`（基于 `predictions` 映射的 `allEvents`）生成，已包含 `id/title/description/tag(image)/deadline/followers_count`。
- 英雄区当前：使用静态 `heroEvents[currentHeroIndex]` 渲染图片、标题与关注数（`apps/web/src/app/trending/page.tsx:2234-2391`）。

## 实现方案
1. 新增计算：`bestEvent`
   - `useMemo` 基于 `displayEvents` 和 `selectedCategory` 计算：
     - 过滤到当前专题（若已选择），否则不筛选。
     - 按 `followers_count` 降序；若相同，按距离当前时间的“剩余到期时间”升序（已到期或缺失视为 `Infinity`）。
   - 有效则返回事件对象；为空则返回 `null`。

2. 替换英雄区内容
   - 将图片轮播 `<motion.img>` 列表替换为单张图片：使用 `bestEvent?.image` 与 `bestEvent?.title`。
   - 移除指示点与左右切换按钮（或保留但不再使用 `currentHeroIndex`），保持轻量动画。
   - 右侧专题激活态改为：`isActive = bestEvent?.tag === category.name`。
   - “当前事件详情”区域改用 `bestEvent?.title / description / followers_count`。
   - 若 `bestEvent` 为 `null`（无数据或筛选后为空），回退到原静态 `heroEvents[0]` 以保证可用性。

3. 交互与状态
   - 点击专题卡片仅设置 `selectedCategory`，由 `bestEvent` 自动联动，无需维护 `currentHeroIndex`。
   - 保留现有筛选/搜索逻辑（`displayEvents` 已适配）。

## 代码改动点位（不新增文件）
- `apps/web/src/app/trending/page.tsx`：
  - 新增 `bestEvent` 计算（靠近 `sortedEvents` 处）。
  - 替换英雄区图片与详情（`2234-2391` 区段）。
  - 调整专题激活态与点击逻辑。

## 边界与回退
- `followers_count` 缺失视为 `0`；`deadline` 缺失或已过期在并列时排后。
- 当筛选导致无事件时，英雄区回退显示首个静态事件，避免空白。

## 验证方案
- 交互验证：选择不同专题/搜索条件，英雄区应动态切换到对应“关注量最高”卡片；并在关注量相同的情况下，显示截止更近的事件。
- 数据验证：通过现有右侧“未结算事件”列表的“关注最多/临近截止”切换，观察与英雄区一致性。
- 性能与动画：保持单图淡入动画，不新增复杂动效；滚动与渲染无卡顿。

是否按该方案在 `trending/page.tsx` 实施修改？