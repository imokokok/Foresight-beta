"use client";

import { useState, useEffect, useRef, ImgHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "@/lib/i18n";

interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  /**
   * 提前加载的距离（像素）
   * @default 50
   */
  rootMargin?: number;
  /**
   * 是否显示加载动画
   * @default true
   */
  showLoadingAnimation?: boolean;
  /**
   * 占位图（可选）
   */
  placeholderSrc?: string;
  /**
   * 是否启用渐入动画
   * @default true
   */
  fadeIn?: boolean;
  /**
   * 加载失败时的占位图
   */
  fallbackSrc?: string;
}

/**
 * 高性能图片懒加载组件
 *
 * 特性：
 * - 使用 IntersectionObserver 实现真正的懒加载
 * - 支持渐入动画
 * - 支持加载失败降级
 * - 支持自定义占位图
 * - 自动清理资源
 *
 * @example
 * ```tsx
 * <LazyImage
 *   src="/image.jpg"
 *   alt="描述"
 *   className="w-full h-full object-cover"
 *   rootMargin={100}
 * />
 * ```
 */
export default function LazyImage({
  src,
  alt,
  className = "",
  placeholderClassName = "",
  rootMargin = 50,
  showLoadingAnimation = true,
  placeholderSrc,
  fadeIn = true,
  fallbackSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3C/svg%3E",
  ...props
}: LazyImageProps) {
  const tErrors = useTranslations("errors");
  const defaultFallbackSrc =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3C/svg%3E";
  const [imgSrc, setImgSrc] = useState(src);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 设置 IntersectionObserver
  useEffect(() => {
    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          // 一旦进入视口就停止观察，节省资源
          observerRef.current?.disconnect();
        }
      },
      {
        rootMargin: `${rootMargin}px`,
        threshold: 0.01, // 只要露出一点就开始加载
      }
    );

    observerRef.current.observe(imgRef.current);

    // 清理函数
    return () => {
      observerRef.current?.disconnect();
    };
  }, [rootMargin]);

  useEffect(() => {
    const nextSrc = String(src || "").trim();
    const next = nextSrc ? nextSrc : fallbackSrc;
    setImgSrc(next);
    setLoaded(false);
    setError(!nextSrc);
  }, [src, fallbackSrc]);

  // 加载图片
  const handleLoad = () => {
    setLoaded(true);
  };

  const handleError = () => {
    if (imgSrc !== fallbackSrc) {
      setError(true);
      setLoaded(false);
      setImgSrc(fallbackSrc);
      return;
    }
    setError(true);
    setLoaded(true);
  };

  // 占位图的默认样式
  const defaultPlaceholderClass = "bg-gray-200 animate-pulse";

  // 如果有自定义占位图，使用它
  const showPlaceholder = !inView || (!loaded && showLoadingAnimation);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {/* 占位图或加载动画 */}
      {showPlaceholder && (
        <div className={`absolute inset-0 ${placeholderClassName || defaultPlaceholderClass}`}>
          {placeholderSrc ? (
            <img
              src={placeholderSrc}
              alt=""
              className="w-full h-full object-cover blur-sm"
              aria-hidden="true"
            />
          ) : (
            // 默认的渐变占位
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
          )}
        </div>
      )}

      {/* 实际图片 */}
      {inView && (
        <>
          {fadeIn ? (
            <motion.img
              src={imgSrc}
              alt={alt}
              onLoad={handleLoad}
              onError={handleError}
              initial={{ opacity: 0 }}
              animate={{ opacity: loaded ? 1 : 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={className}
              loading="lazy" // 浏览器原生懒加载作为后备
              {...(props as any)}
            />
          ) : (
            <img
              src={imgSrc}
              alt={alt}
              onLoad={handleLoad}
              onError={handleError}
              className={`${className} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
              loading="lazy"
              {...props}
            />
          )}
        </>
      )}

      {/* 加载失败提示（可选） */}
      {error && loaded && fallbackSrc === defaultFallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-400">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-xs">{tErrors("imageLoadFailed")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 圆形头像懒加载组件（常用于用户头像）
 */
export function LazyAvatar({
  src,
  alt,
  size = 40,
  className = "",
  ...props
}: Omit<LazyImageProps, "className"> & {
  size?: number;
  className?: string;
}) {
  return (
    <LazyImage
      src={src}
      alt={alt}
      className={`rounded-full object-cover ${className}`}
      placeholderClassName="rounded-full bg-gradient-to-br from-purple-100 to-pink-100"
      style={{ width: size, height: size }}
      {...props}
    />
  );
}

/**
 * 卡片封面图懒加载组件
 */
export function LazyCardCover({
  src,
  alt,
  aspectRatio = "16/9",
  className = "",
  ...props
}: Omit<LazyImageProps, "className"> & {
  aspectRatio?: string;
  className?: string;
}) {
  return (
    <div style={{ aspectRatio }} className="relative overflow-hidden">
      <LazyImage
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${className}`}
        {...props}
      />
    </div>
  );
}
