import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type UseRealtimePredictionsOptions = {
  onNewPrediction?: (prediction: Record<string, unknown>) => void;
  onUpdate?: (prediction: Record<string, unknown>) => void;
  enabled?: boolean;
};

/**
 * 实时订阅预测表变更
 * 用于监听新话题的创建和更新
 */
export function useRealtimePredictions(options: UseRealtimePredictionsOptions = {}) {
  const { onNewPrediction, onUpdate, enabled = true } = options;
  const [newCount, setNewCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef({ onNewPrediction, onUpdate });

  // 更新回调引用，避免重新订阅
  useEffect(() => {
    callbacksRef.current = { onNewPrediction, onUpdate };
  }, [onNewPrediction, onUpdate]);

  // 重置新话题计数
  const resetNewCount = useCallback(() => {
    setNewCount(0);
  }, []);

  useEffect(() => {
    if (!enabled || !supabase) return;

    const channel = supabase
      .channel("predictions-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "predictions",
        },
        (payload: RealtimePayload) => {
          if (payload.eventType === "INSERT") {
            setNewCount((prev) => prev + 1);
            callbacksRef.current.onNewPrediction?.(payload.new);
          } else if (payload.eventType === "UPDATE") {
            callbacksRef.current.onUpdate?.(payload.new);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);

  return {
    newCount,
    resetNewCount,
    isConnected,
  };
}

