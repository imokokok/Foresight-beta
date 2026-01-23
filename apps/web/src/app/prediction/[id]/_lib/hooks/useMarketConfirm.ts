"use client";

import { useState, useCallback } from "react";

type ConfirmState = null | {
  message: string;
  onConfirm: () => void | Promise<void>;
};

export function useMarketConfirm() {
  const [marketConfirmState, setMarketConfirmState] = useState<ConfirmState>(null);

  const setMarketConfirm = useCallback((state: ConfirmState) => {
    setMarketConfirmState(state);
  }, []);

  const cancelMarketConfirm = useCallback(() => {
    setMarketConfirmState(null);
  }, []);

  const runMarketConfirm = useCallback(async () => {
    if (!marketConfirmState) return;
    await marketConfirmState.onConfirm();
    setMarketConfirmState(null);
  }, [marketConfirmState]);

  const closeMarketConfirm = useCallback(() => {
    setMarketConfirmState(null);
  }, []);

  return {
    marketConfirmState,
    setMarketConfirm,
    marketConfirmOpen: marketConfirmState !== null,
    marketConfirmMessage: marketConfirmState?.message || null,
    cancelMarketConfirm,
    runMarketConfirm,
    closeMarketConfirm,
  };
}
