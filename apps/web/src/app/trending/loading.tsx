export default function Loading() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-pink-50 overflow-hidden">
      {/* 背景装饰（与页面风格一致） */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-xl"></div>
      </div>

      {/* 加载指示 */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在载入热门事件…</p>
        </div>
      </div>
    </div>
  );
}