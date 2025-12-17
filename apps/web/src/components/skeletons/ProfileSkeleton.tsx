/**
 * 个人资料骨架屏
 */
export function ProfileSkeleton() {
  return (
    <div className="animate-pulse max-w-4xl mx-auto p-6">
      {/* 头部 */}
      <div className="bg-white rounded-3xl p-8 mb-6 border border-gray-100">
        <div className="flex items-center gap-6">
          {/* 头像 */}
          <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
          
          {/* 信息 */}
          <div className="flex-1">
            <div className="h-8 bg-gray-200 rounded-lg w-48 mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
        </div>
        
        {/* 统计 */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="h-8 bg-gray-200 rounded-lg w-16 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 内容区 */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="py-4 border-b border-gray-100 last:border-0">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

