"use client";

import { useState } from "react";

export function useTradingState() {
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeOutcome, setTradeOutcome] = useState<number>(0);
  const [priceInput, setPriceInput] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [orderMode, setOrderMode] = useState<"limit" | "best">("best");
  const [tif, setTif] = useState<"GTC" | "IOC" | "FOK">("GTC");
  const [postOnly, setPostOnly] = useState(false);
  const [maxSlippage, setMaxSlippage] = useState<number>(1);
  const [editingOrderSalt, setEditingOrderSalt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  return {
    tradeSide,
    setTradeSide,
    tradeOutcome,
    setTradeOutcome,
    priceInput,
    setPriceInput,
    amountInput,
    setAmountInput,
    orderMode,
    setOrderMode,
    tif,
    setTif,
    postOnly,
    setPostOnly,
    maxSlippage,
    setMaxSlippage,
    editingOrderSalt,
    setEditingOrderSalt,
    isSubmitting,
    setIsSubmitting,
    orderMsg,
    setOrderMsg,
  };
}
