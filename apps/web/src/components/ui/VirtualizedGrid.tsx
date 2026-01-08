"use client";

import React, { useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * 响应式列数 hook
 * 根据窗口宽度返回合适的列数
 */
function useResponsiveColumns(defaultColumns = 4): number {
  const [columns, setColumns] = React.useState(defaultColumns);

  React.useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setColumns(1); // mobile
      } else if (width < 1024) {
        setColumns(2); // tablet
      } else {
        setColumns(4); // desktop
      }
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  return columns;
}

export type VirtualizedGridProps<T> = {
  /** 数据列表 */
  items: T[];
  /** 渲染每个项目的函数 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 获取每个项目的唯一 key */
  getItemKey: (item: T, index: number) => string | number;
  /** 预估的行高度 (px) */
  estimatedRowHeight?: number;
  /** 预渲染的额外行数 */
  overscan?: number;
  /** 容器高度 */
  containerHeight?: string;
  /** 网格间距 class */
  gapClassName?: string;
  /** 空状态渲染 */
  emptyState?: React.ReactNode;
  /** 加载更多触发器 */
  loadMoreTrigger?: React.ReactNode;
  /** 列数覆盖（不使用响应式） */
  columns?: number;
};

/**
 * 虚拟化网格组件
 * 只渲染可见区域的项目，大幅提升大数据量下的性能
 */
export function VirtualizedGrid<T>({
  items,
  renderItem,
  getItemKey,
  estimatedRowHeight = 320,
  overscan = 3,
  containerHeight = "calc(100vh - 300px)",
  gapClassName = "gap-6",
  emptyState,
  loadMoreTrigger,
  columns: columnsProp,
}: VirtualizedGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const responsiveColumns = useResponsiveColumns(4);
  const columns = columnsProp ?? responsiveColumns;

  // 计算行数
  const rowCount = useMemo(() => Math.ceil(items.length / columns), [items.length, columns]);

  // 虚拟化配置
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => estimatedRowHeight, [estimatedRowHeight]),
    overscan,
  });

  // 获取虚拟行
  const virtualRows = virtualizer.getVirtualItems();

  // 空状态
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // 根据列数生成 grid-cols class
  const getGridColsClass = () => {
    switch (columns) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-2";
      case 3:
        return "grid-cols-3";
      case 4:
      default:
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
    }
  };

  return (
    <div
      ref={parentRef}
      className="overflow-auto scrollbar-hide"
      style={{ height: containerHeight }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowStart = virtualRow.index * columns;
          const rowItems = items.slice(rowStart, rowStart + columns);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className={`grid ${getGridColsClass()} ${gapClassName}`}>
                {rowItems.map((item, indexInRow) => {
                  const globalIndex = rowStart + indexInRow;
                  return (
                    <div key={getItemKey(item, globalIndex)}>{renderItem(item, globalIndex)}</div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 加载更多触发器 */}
      {loadMoreTrigger}
    </div>
  );
}

/**
 * 虚拟化网格的骨架屏
 */
export function VirtualizedGridSkeleton({
  count = 8,
  columns = 4,
  gapClassName = "gap-6",
}: {
  count?: number;
  columns?: number;
  gapClassName?: string;
}) {
  const getGridColsClass = () => {
    switch (columns) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-2";
      case 3:
        return "grid-cols-3";
      case 4:
      default:
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
    }
  };

  return (
    <div className={`grid ${getGridColsClass()} ${gapClassName}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-3xl border border-gray-100 bg-white/60 shadow-sm p-4 animate-pulse space-y-4"
        >
          <div className="h-40 rounded-2xl bg-gray-200" />
          <div className="h-4 rounded-full bg-gray-200 w-3/4" />
          <div className="h-3 rounded-full bg-gray-200 w-5/6" />
          <div className="flex items-center justify-between pt-2">
            <div className="h-3 rounded-full bg-gray-200 w-1/3" />
            <div className="h-8 rounded-full bg-gray-200 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default VirtualizedGrid;
