// 统一导出所有骨架屏组件
export * from "./CardSkeleton";
export * from "./ProfileSkeleton";
export * from "./TableSkeleton";
export { default as FlagCardSkeleton, FlagCardListSkeleton } from "./FlagCardSkeleton";

/**
 * 通用文本骨架屏
 */
export function TextSkeleton({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        ></div>
      ))}
    </div>
  );
}

/**
 * 按钮骨架屏
 */
export function ButtonSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse h-10 bg-gray-200 rounded-lg ${className}`}></div>;
}

/**
 * 图片骨架屏
 */
export function ImageSkeleton({
  aspectRatio = "16/9",
  className = "",
}: {
  aspectRatio?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-lg ${className}`}
      style={{ aspectRatio }}
    ></div>
  );
}

/**
 * 圆形骨架屏（用于头像等）
 */
export function CircleSkeleton({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-full ${sizeClasses[size]} ${className}`}
    ></div>
  );
}
