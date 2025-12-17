/**
 * 表格骨架屏
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse bg-white rounded-2xl overflow-hidden border border-gray-100">
      {/* 表头 */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="p-4">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 表体 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div 
          key={i} 
          className="grid border-b border-gray-100 last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="p-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

