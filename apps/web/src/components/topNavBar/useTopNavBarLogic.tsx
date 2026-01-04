"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export function useTopNavBarLogic() {
  const {
    account,
    isConnecting,
    connectError,
    hasProvider,
    chainId,
    balanceEth,
    balanceLoading,
    refreshBalance,
    connectWallet,
    disconnectWallet,
    formatAddress,
    availableWallets,
    currentWalletType,
    switchNetwork,
  } = useWallet();
  const { user, loading: authLoading, signOut } = useAuth();
  const userProfile = useUserProfileOptional();
  const tWallet = useTranslations("wallet");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tNotifications = useTranslations("notifications");

  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const walletSelectorRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<HTMLImageElement | null>(null);
  const menuContentRef = useRef<HTMLDivElement | null>(null);
  const walletButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [walletSelectorPos, setWalletSelectorPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      created_at: string;
      url?: string;
    }>
  >([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    if (connectError) body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [connectError, mounted]);

  const viewerId = useMemo(() => String(account || "").toLowerCase(), [account]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!viewerId) {
        if (!cancelled) {
          setNotifications([]);
          setNotificationsCount(0);
        }
        return;
      }
      try {
        let pendingCount = 0;
        try {
          const res = await fetch(`/api/flags?viewer_id=${encodeURIComponent(viewerId)}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}) as any);
            const list = Array.isArray(data?.flags) ? data.flags : [];
            pendingCount = list.filter(
              (f: any) =>
                String(f.status || "") === "pending_review" &&
                String(f.verification_type || "") === "witness" &&
                String(f.witness_id || "").toLowerCase() === viewerId
            ).length;
          }
        } catch {}
        let inviteCount = 0;
        let notificationItems: Array<{
          id: string;
          type: string;
          title: string;
          message: string;
          created_at: string;
          url?: string;
        }> | null = null;
        if (supabase) {
          try {
            const res = await supabase
              .from("discussions")
              .select("id, content, created_at")
              .eq("user_id", viewerId)
              .order("created_at", { ascending: false })
              .limit(20);
            const rows = Array.isArray(res.data) ? res.data : [];
            notificationItems = rows.map((row: any) => {
              let raw = row.content as any;
              let parsed: any = {};
              if (typeof raw === "string") {
                try {
                  parsed = JSON.parse(raw);
                } catch {
                  parsed = {};
                }
              } else if (raw && typeof raw === "object") {
                parsed = raw;
              }
              const type = typeof parsed.type === "string" ? parsed.type : "";
              const titleFallback =
                type === "witness_invite"
                  ? tNotifications("fallbackWitnessInviteTitle")
                  : type === "checkin_review"
                    ? tNotifications("fallbackCheckinReviewTitle")
                    : tNotifications("fallbackGenericTitle");
              const title =
                typeof parsed.title === "string" && parsed.title.trim()
                  ? parsed.title
                  : titleFallback;
              const message = typeof parsed.message === "string" ? parsed.message : "";
              const url = typeof parsed.url === "string" && parsed.url ? parsed.url : "/flags";
              return {
                id: String(row.id),
                type,
                title,
                message,
                created_at: String(row.created_at),
                url,
              };
            });
            inviteCount = notificationItems.length;
          } catch {}
        }
        if (!cancelled) {
          if (notificationItems) {
            setNotifications(notificationItems);
          }
          setNotificationsCount(pendingCount + inviteCount);
        }
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setNotificationsCount(0);
        }
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [viewerId, tNotifications]);

  useEffect(() => {
    if (!viewerId || !supabase) return;
    const client = supabase;
    const channel = client
      .channel(`discussions:nav:${viewerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "discussions",
          filter: `user_id=eq.${viewerId}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          let raw = row.content as any;
          let parsed: any = {};
          if (typeof raw === "string") {
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = {};
            }
          } else if (raw && typeof raw === "object") {
            parsed = raw;
          }
          const type = typeof parsed.type === "string" ? parsed.type : "";
          const titleFallback =
            type === "witness_invite"
              ? tNotifications("fallbackWitnessInviteTitle")
              : type === "checkin_review"
                ? tNotifications("fallbackCheckinReviewTitle")
                : tNotifications("fallbackGenericTitle");
          const title =
            typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : titleFallback;
          const message = typeof parsed.message === "string" ? parsed.message : "";
          const url = typeof parsed.url === "string" && parsed.url ? parsed.url : "/flags";
          const item = {
            id: String(row.id),
            type,
            title,
            message,
            created_at: String(row.created_at),
            url,
          };
          setNotifications((prev) => {
            const exists = prev.some((x) => x.id === item.id);
            if (exists) return prev;
            return [item, ...prev].slice(0, 50);
          });
          setNotificationsCount((prev) => prev + 1);
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [viewerId, tNotifications]);

  const handleConnectWallet = useCallback(
    async (walletType?: "metamask" | "coinbase" | "binance") => {
      await connectWallet(walletType);
      setWalletSelectorOpen(false);
    },
    [connectWallet]
  );

  const handleWalletSelectorToggle = useCallback(() => {
    setWalletSelectorOpen(!walletSelectorOpen);
  }, [walletSelectorOpen]);

  const handleDisconnectWallet = useCallback(async () => {
    await disconnectWallet();
    try {
      await fetch("/api/siwe/logout", { method: "GET" });
    } catch {}
    setMenuOpen(false);
  }, [disconnectWallet]);

  const copyAddress = useCallback(async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [account]);

  const networkName = (id: string | null) => {
    if (!id) return tWallet("unknownNetwork");
    switch (id.toLowerCase()) {
      case "0x1":
        return "Ethereum";
      case "0xaa36a7":
        return "Sepolia";
      case "0x5":
        return "Goerli";
      case "0x89":
        return "Polygon";
      case "0x38":
        return "BSC";
      default:
        return id;
    }
  };

  const walletTypeLabel = useMemo(() => {
    if (currentWalletType === "metamask") return "MetaMask";
    if (currentWalletType === "coinbase") return "Coinbase";
    if (currentWalletType === "okx") return "OKX";
    if (currentWalletType === "binance") return "Binance";
    return "";
  }, [currentWalletType]);

  const isSepolia = useMemo(() => {
    if (!chainId) return false;
    return chainId.toLowerCase() === "0xaa36a7";
  }, [chainId]);

  const explorerBase = (id: string | null) => {
    const low = id?.toLowerCase();
    switch (low) {
      case "0x1":
        return "https://etherscan.io";
      case "0xaa36a7":
        return "https://sepolia.etherscan.io";
      case "0x5":
        return "https://goerli.etherscan.io";
      case "0x89":
        return "https://polygonscan.com";
      case "0x38":
        return "https://bscscan.com";
      default:
        return "https://etherscan.io";
    }
  };

  const updateNetworkInfo = useCallback(async () => {
    await refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    updateNetworkInfo();
  }, [account, updateNetworkInfo]);

  const openOnExplorer = () => {
    if (!account) return;
    const url = `${explorerBase(chainId)}/address/${account}`;
    window.open(url, "_blank");
    setMenuOpen(false);
  };

  const switchToSepolia = async () => {
    try {
      await switchNetwork(11155111);
      updateNetworkInfo();
    } catch (e) {
      console.error("Switch chain failed:", e);
    } finally {
      setMenuOpen(false);
    }
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (avatarRef.current && avatarRef.current.contains(target)) return;
      if (menuContentRef.current && menuContentRef.current.contains(target)) return;
      if (walletButtonRef.current && walletButtonRef.current.contains(target)) return;
      if (walletSelectorRef.current && walletSelectorRef.current.contains(target)) return;
      setMenuOpen(false);
      setWalletSelectorOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setWalletSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const updateMenuPosition = () => {
      if (!avatarRef.current) return;
      const rect = avatarRef.current.getBoundingClientRect();
      const menuWidth = 256;
      const gap = 8;
      let left = rect.right - menuWidth;
      let top = rect.bottom + gap;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      left = Math.max(8, Math.min(left, vw - menuWidth - 8));
      top = Math.max(8, Math.min(top, vh - 8));
      setMenuPos({ top, left });
    };

    if (menuOpen) {
      updateMenuPosition();
      const handler = () => updateMenuPosition();
      window.addEventListener("resize", handler);
      window.addEventListener("scroll", handler, true);
      return () => {
        window.removeEventListener("resize", handler);
        window.removeEventListener("scroll", handler, true);
      };
    }
  }, [menuOpen]);

  useEffect(() => {
    const updateWalletSelectorPosition = () => {
      if (!walletButtonRef.current) return;
      const rect = walletButtonRef.current.getBoundingClientRect();
      const selectorWidth = 200;
      const gap = 8;
      let left = rect.left;
      let top = rect.bottom + gap;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      left = Math.max(8, Math.min(left, vw - selectorWidth - 8));
      top = Math.max(8, Math.min(top, vh - 8));
      setWalletSelectorPos({ top, left });
    };

    if (walletSelectorOpen) {
      updateWalletSelectorPosition();
      const handler = () => updateWalletSelectorPosition();
      window.addEventListener("resize", handler);
      window.addEventListener("scroll", handler, true);
      return () => {
        window.removeEventListener("resize", handler);
        window.removeEventListener("scroll", handler, true);
      };
    }
  }, [walletSelectorOpen]);

  const modal = connectError ? (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={() => {}}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-[90%]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-black mb-2">{tWallet("connectFailedTitle")}</h3>
        <p className="text-sm text-black mb-4">{connectError}</p>
        {!hasProvider && (
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-black underline"
          >
            {tWallet("installMetaMaskExtension")}
          </a>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-2 rounded-md border border-gray-300 text-black"
            onClick={() => {
              location.reload();
            }}
          >
            {tCommon("close")}
          </button>
          <button
            className="px-3 py-2 rounded-md bg-blue-500 text-black"
            onClick={() => connectWallet()}
          >
            {tCommon("retry")}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return {
    account,
    isConnecting,
    connectError,
    hasProvider,
    chainId,
    balanceEth,
    balanceLoading,
    refreshBalance,
    connectWallet,
    disconnectWallet,
    formatAddress,
    availableWallets,
    currentWalletType,
    switchNetwork,
    user,
    authLoading,
    signOut,
    userProfile,
    tWallet,
    tAuth,
    tCommon,
    mounted,
    menuOpen,
    setMenuOpen,
    copied,
    showBalance,
    setShowBalance,
    walletSelectorOpen,
    setWalletSelectorOpen,
    walletModalOpen,
    setWalletModalOpen,
    menuRef,
    walletSelectorRef,
    avatarRef,
    menuContentRef,
    walletButtonRef,
    menuPos,
    walletSelectorPos,
    handleConnectWallet,
    handleWalletSelectorToggle,
    handleDisconnectWallet,
    copyAddress,
    networkName,
    walletTypeLabel,
    isSepolia,
    explorerBase,
    updateNetworkInfo,
    openOnExplorer,
    switchToSepolia,
    modal,
    notifications,
    notificationsCount,
    notificationsOpen,
    setNotificationsOpen,
  };
}

export type TopNavBarState = ReturnType<typeof useTopNavBarLogic>;
