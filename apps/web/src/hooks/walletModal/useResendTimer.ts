"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useRef } from "react";

export function useResendTimer() {
  const resendTimerRef = useRef<number | null>(null);

  const clearResendTimer = useCallback(() => {
    if (resendTimerRef.current !== null) {
      window.clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }, []);

  const startResendCountdown = useCallback(
    (seconds: number, setResendLeft: Dispatch<SetStateAction<number>>) => {
      if (seconds <= 0) {
        setResendLeft(0);
        return;
      }
      clearResendTimer();
      setResendLeft(seconds);
      const id = window.setInterval(() => {
        setResendLeft((prev) => {
          if (prev <= 1) {
            window.clearInterval(id);
            resendTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      resendTimerRef.current = id;
    },
    [clearResendTimer]
  );

  return {
    clearResendTimer,
    startResendCountdown,
  };
}
