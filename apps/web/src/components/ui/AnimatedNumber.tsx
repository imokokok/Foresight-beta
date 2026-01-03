"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { formatNumber } from "@/lib/format";
type AnimatedNumberProps = {
  value: number;
  duration?: number;
  className?: string;
  formatOptions?: Intl.NumberFormatOptions;
};

/**
 * 数字递增动画组件
 * 当 value 变化时，数字会从旧值平滑过渡到新值
 */
export function AnimatedNumber({
  value,
  duration = 0.8,
  className = "",
  formatOptions,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  // 使用 spring 动画实现平滑过渡
  const spring = useSpring(prevValueRef.current, {
    stiffness: 100,
    damping: 20,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (latest) => {
    const num = Math.round(latest);
    if (formatOptions) {
      return formatNumber(num, undefined, formatOptions);
    }
    return formatNumber(num);
  });

  useEffect(() => {
    // 当值变化时，更新 spring 目标值
    if (value !== prevValueRef.current) {
      spring.set(value);
      prevValueRef.current = value;
    }
  }, [value, spring]);

  // 订阅 display 的变化并更新 state
  useEffect(() => {
    const unsubscribe = display.on("change", (v) => {
      setDisplayValue(v as unknown as number);
    });
    return () => unsubscribe();
  }, [display]);

  return (
    <motion.span
      className={className}
      key={value}
      initial={{ opacity: 0.8, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {displayValue}
    </motion.span>
  );
}

type AnimatedCounterProps = {
  value: number;
  duration?: number;
  className?: string;
};

/**
 * 简化版数字计数器
 * 使用 CSS 动画，更轻量
 */
export function AnimatedCounter({ value, duration = 0.6, className = "" }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    const startTime = performance.now();
    const durationMs = duration * 1000;

    // 取消之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // 使用 easeOutExpo 缓动函数
      const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutExpo);

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span
      className={`inline-block tabular-nums ${className}`}
      style={{
        transition: "transform 0.15s ease-out",
        transform: displayValue !== value ? "scale(1.05)" : "scale(1)",
      }}
    >
      {formatNumber(displayValue)}
    </span>
  );
}
