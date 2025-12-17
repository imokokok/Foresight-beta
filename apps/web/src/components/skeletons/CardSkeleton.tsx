/**
 * 卡片骨架屏组件
 * 用于预测卡片、Flag卡片等的加载状态
 */
export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100">
      {/* 图片占位 */}
      <div className="w-full h-48 bg-gray-200 rounded-2xl mb-4"></div>
      
      {/* 标题 */}
      <div className="h-6 bg-gray-200 rounded-lg w-3/4 mb-3"></div>
      
      {/* 描述 */}
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
      
      {/* 底部信息 */}
      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-8 bg-gray-200 rounded-lg w-20"></div>
      </div>
    </div>
  );
}

/**
 * 卡片列表骨架屏
 */
export function CardListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

