"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 数据保持新鲜的时间（5分钟）
        staleTime: 5 * 60 * 1000,
        
        // 缓存时间（10分钟）
        gcTime: 10 * 60 * 1000,
        
        // 失败后重试次数
        retry: 1,
        
        // 重试延迟（指数退避）
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // 窗口重新获得焦点时不自动重新获取
        refetchOnWindowFocus: false,
        
        // 网络重连时重新获取
        refetchOnReconnect: true,
        
        // 挂载时不自动重新获取（使用缓存）
        refetchOnMount: false,
      },
      mutations: {
        // 失败后重试次数（mutation 通常不重试）
        retry: 0,
        
        // 错误处理
        onError: (error) => {
          console.error('Mutation error:', error);
        },
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 仅在开发环境显示 DevTools */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  );
}
