"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

// NProgress 配置
NProgress.configure({
  showSpinner: false, // 不显示转圈圈
  trickleSpeed: 200, // 自动递增速度
  minimum: 0.1, // 最小百分比
  easing: "ease", // 缓动函数
  speed: 500, // 动画速度
});

/**
 * 顶部进度条组件
 *
 * 自动在路由切换时显示加载进度
 *
 * 特性：
 * - 路由切换自动显示/隐藏
 * - 可自定义样式
 * - 支持手动触发
 *
 * @example
 * ```tsx
 * // 在 layout.tsx 中使用
 * <ProgressBar />
 *
 * // 手动触发
 * import NProgress from 'nprogress';
 *
 * NProgress.start(); // 开始
 * NProgress.inc();   // 增加
 * NProgress.done();  // 完成
 * ```
 */
export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 路由改变时启动进度条
    NProgress.start();

    // 添加一个短暂延迟以确保动画流畅
    const timer = setTimeout(() => {
      NProgress.done();
    }, 100);

    return () => {
      clearTimeout(timer);
      NProgress.done();
    };
  }, [pathname, searchParams]);

  return null; // 不渲染任何内容，只是触发进度条
}

/**
 * 手动进度条控制
 *
 * 用于 API 请求或其他异步操作
 */
export const progress = {
  /**
   * 开始显示进度条
   */
  start: () => {
    NProgress.start();
  },

  /**
   * 增加进度（自动）
   */
  inc: () => {
    NProgress.inc();
  },

  /**
   * 设置进度到指定百分比
   * @param n 0-1 之间的数字
   */
  set: (n: number) => {
    NProgress.set(n);
  },

  /**
   * 完成并隐藏进度条
   */
  done: () => {
    NProgress.done();
  },

  /**
   * Promise 包装器
   * 自动显示/隐藏进度条
   */
  wrap: async <T,>(promise: Promise<T>): Promise<T> => {
    NProgress.start();
    try {
      const result = await promise;
      NProgress.done();
      return result;
    } catch (error) {
      NProgress.done();
      throw error;
    }
  },
};
