'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 记录错误到监控服务（如 Sentry）
    console.error('Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-red-200/30 to-orange-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-pink-200/30 to-red-200/30 rounded-full blur-xl"></div>
      </div>

      <div className="relative max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100">
        {/* 错误图标 */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-orange-100 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        {/* 标题 */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          哎呀，出错了！
        </h1>

        {/* 错误信息 */}
        <p className="text-gray-600 text-center mb-2">
          应用程序遇到了一个意外错误
        </p>

        {/* 错误详情（开发环境） */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-mono text-gray-700 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500 mt-2">
                错误 ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* 生产环境友好提示 */}
        {process.env.NODE_ENV === 'production' && (
          <p className="text-sm text-gray-500 text-center mt-4">
            我们已经记录了这个问题，会尽快修复
            {error.digest && ` (错误 ID: ${error.digest})`}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <RefreshCcw className="w-4 h-4" />
            重试
          </button>
          <Link
            href="/trending"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            返回首页
          </Link>
        </div>

        {/* 帮助文本 */}
        <p className="text-xs text-gray-400 text-center mt-6">
          如果问题持续存在，请联系技术支持
        </p>
      </div>
    </div>
  );
}

