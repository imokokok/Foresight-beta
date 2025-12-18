/**
 * FlagCard 骨架屏组件
 * 
 * 在 Flag 数据加载时显示，提供更好的加载体验
 */
export default function FlagCardSkeleton() {
  return (
    <div className="h-full rounded-[2rem] bg-white border-[6px] border-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden animate-pulse">
      {/* 顶部装饰（和纸胶带效果）*/}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-8 bg-gray-200 opacity-90 rotate-[-2deg] z-20 shadow-sm" />
      
      {/* 头部渐变区 */}
      <div className="h-28 w-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-50" />
      
      {/* 内容区 */}
      <div className="p-6 space-y-4">
        {/* 标题 */}
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded-xl w-3/4" />
          <div className="h-4 bg-gray-200 rounded-lg w-1/2" />
        </div>
        
        {/* 描述 */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded-lg w-full" />
          <div className="h-4 bg-gray-200 rounded-lg w-5/6" />
          <div className="h-4 bg-gray-200 rounded-lg w-4/6" />
        </div>
        
        {/* 统计卡片 */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-3 bg-gray-200 rounded-full w-full" />
        </div>
        
        {/* 底部操作区 */}
        <div className="flex items-center justify-between pt-2">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="w-12 h-12 rounded-2xl bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

/**
 * FlagCard 列表骨架屏
 */
export function FlagCardListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <FlagCardSkeleton key={i} />
      ))}
    </div>
  );
}

