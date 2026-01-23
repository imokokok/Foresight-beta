"use client";

import { useCallback } from "react";
import { useTranslations } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { logClientErrorToApi } from "@/lib/errorReporting";

export function useOrderErrorHandling(tradeSide: "buy" | "sell") {
  const tTrading = useTranslations("trading");

  const createUserError = useCallback((message: string) => {
    const err: any = new Error(message);
    err.__fsUser = true;
    return err;
  }, []);

  const getErrorMeta = useCallback((e: any) => {
    const code =
      typeof e?.code === "string"
        ? String(e.code)
        : typeof e?.error?.code === "string"
          ? String(e.error.code)
          : "";

    const candidates = [
      typeof e?.shortMessage === "string" ? e.shortMessage : "",
      typeof e?.reason === "string" ? e.reason : "",
      typeof e?.info?.error?.message === "string" ? e.info.error.message : "",
      typeof e?.error?.message === "string" ? e.error.message : "",
      typeof e?.message === "string" ? e.message : "",
    ]
      .map((s) => String(s || "").trim())
      .filter(Boolean);

    const rawMessage = candidates[0] || "";
    const isUser = !!e?.__fsUser;

    return { code, rawMessage, isUser };
  }, []);

  const handleOrderError = useCallback(
    (e: any, setOrderMsg: (msg: string | null) => void) => {
      const meta = getErrorMeta(e);
      const lower = meta.rawMessage.toLowerCase();

      const looksRejected =
        meta.code === "ACTION_REJECTED" ||
        lower.includes("user rejected") ||
        lower.includes("user denied") ||
        lower.includes("rejected the request") ||
        lower.includes("request rejected") ||
        lower.includes("denied");

      const looksInsufficientFunds =
        meta.code === "INSUFFICIENT_FUNDS" ||
        lower.includes("insufficient funds") ||
        lower.includes("insufficient balance") ||
        lower.includes("insufficient") ||
        lower.includes("balance too low");

      const looksTimeout =
        meta.code === "TIMEOUT" ||
        meta.code === "NETWORK_ERROR" ||
        lower.includes("timeout") ||
        lower.includes("timed out") ||
        lower.includes("failed to fetch") ||
        lower.includes("network error");

      let msg =
        meta.rawMessage ||
        (looksRejected
          ? tTrading("orderFlow.userRejected")
          : looksInsufficientFunds
            ? tTrading("orderFlow.insufficientFunds")
            : looksTimeout
              ? tTrading("orderFlow.rpcTimeout")
              : tTrading("orderFlow.tradeFailed"));

      if (tradeSide === "sell") {
        const looksLikeNoBalance =
          looksInsufficientFunds ||
          lower.includes("no tokens") ||
          lower.includes("not enough") ||
          lower.includes("balance");
        if (looksLikeNoBalance) {
          msg = tTrading("orderFlow.sellNoBalance");
        } else {
          msg = `${msg} ${tTrading("orderFlow.sellMaybeNoMint")}`;
        }
      }
      setOrderMsg(msg);

      if (looksRejected) {
        toast.info(msg);
        return;
      }

      logClientErrorToApi(
        new Error(`trade_submit_failed:${meta.code || "unknown"}:${meta.rawMessage || msg}`),
        { silent: true }
      );

      if (meta.isUser) {
        toast.warning(msg);
        return;
      }

      toast.error(tTrading("toast.orderFailedTitle"), msg || tTrading("toast.orderFailedDesc"));
    },
    [getErrorMeta, tTrading, tradeSide]
  );

  return {
    createUserError,
    getErrorMeta,
    handleOrderError,
  };
}
