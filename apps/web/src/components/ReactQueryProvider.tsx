"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useCallback } from "react";

/**
 * 🚀 性能优化的 React Query 配置
 *
 * 优化点：
 * - 智能缓存策略（根据数据类型区分）
 * - 结构化共享减少不必要的重渲染
 * - 网络状态感知
 * - 错误边界友好
 */
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 🚀 数据保持新鲜的时间（根据数据变化频率调整）
        staleTime: 2 * 60 * 1000, // 2分钟（从5分钟减少，更及时更新）

        // 🚀 缓存保留时间（15分钟，增加缓存命中率）
        gcTime: 15 * 60 * 1000,

        // 失败后重试次数
        retry: 1,

        // 重试延迟（指数退避）
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // 🚀 窗口重新获得焦点时检查是否过期
        refetchOnWindowFocus: "always",

        // 网络重连时重新获取
        refetchOnReconnect: true,

        // 🚀 挂载时如果数据过期则重新获取
        refetchOnMount: "always",

        // 🚀 启用结构化共享，减少不必要的重渲染
        structuralSharing: true,

        // 🚀 网络离线时不重试
        networkMode: "offlineFirst",
      },
      mutations: {
        retry: 0,
        networkMode: "offlineFirst",
        onError: (error) => {
          // 只在开发环境打印详细错误
          if (process.env.NODE_ENV === "development") {
            console.error("Mutation error:", error);
          }
        },
      },
    },
  });
}

// 🚀 单例模式，避免在 SSR 时创建多个实例
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // 服务端：始终创建新实例
    return createQueryClient();
  }
  // 浏览器：复用同一实例
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 仅在开发环境显示 DevTools */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}

/**
 * 🚀 导出 queryClient 实例，用于预取数据
 */
export { getQueryClient };
