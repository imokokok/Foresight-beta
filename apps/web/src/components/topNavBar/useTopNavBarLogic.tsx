"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";

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
  const prevUserIdRef = useRef<string | null>(user?.id ?? null);
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
      unread?: boolean;
      read_at?: string | null;
    }>
  >([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);
  const [notificationsCursor, setNotificationsCursor] = useState<string | null>(null);
  const [notificationsHasMore, setNotificationsHasMore] = useState(false);
  const [markAllNotificationsLoading, setMarkAllNotificationsLoading] = useState(false);
  const [archiveNotificationIdLoading, setArchiveNotificationIdLoading] = useState<string | null>(
    null
  );
  const [archiveAllNotificationsLoading, setArchiveAllNotificationsLoading] = useState(false);
  const [notificationsFilter, setNotificationsFilter] = useState<
    "all" | "system" | "review" | "challenge"
  >("all");
  const pollingInFlightRef = useRef(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    const curr = user?.id ?? null;
    if (walletModalOpen && !prev && curr) {
      setWalletModalOpen(false);
    }
    prevUserIdRef.current = curr;
  }, [user?.id, walletModalOpen]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fs_notifications_filter");
      if (saved === "all" || saved === "system" || saved === "review" || saved === "challenge") {
        setNotificationsFilter(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem("fs_notifications_filter", notificationsFilter);
    } catch {}
  }, [mounted, notificationsFilter]);

  useEffect(() => {
    const update = () => {
      setPageVisible(!document.hidden);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
    };
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

  const safeUrl = useCallback((candidate: unknown) => {
    if (typeof candidate !== "string") return "/flags";
    const trimmed = candidate.trim();
    if (!trimmed.startsWith("/")) return "/flags";
    return trimmed;
  }, []);

  const titleFallbackForType = useCallback(
    (type: string) => {
      return type === "witness_invite"
        ? tNotifications("fallbackWitnessInviteTitle")
        : type === "checkin_review"
          ? tNotifications("fallbackCheckinReviewTitle")
          : tNotifications("fallbackGenericTitle");
    },
    [tNotifications]
  );

  const markNotificationsRead = useCallback(async (ids: string[]) => {
    const numericIds = ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (!numericIds.length) return;
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: numericIds }),
      });
    } catch {}
  }, []);

  const fetchNotifications = useCallback(
    async (options?: { append?: boolean; resetCursor?: boolean }) => {
      if (!viewerId) {
        setNotifications([]);
        setNotificationsCursor(null);
        setNotificationsHasMore(false);
        setNotificationsError(false);
        return;
      }
      const append = options?.append === true;
      const resetCursor = options?.resetCursor === true;
      const cursor = append && !resetCursor && notificationsCursor ? notificationsCursor : null;
      setNotificationsLoading(true);
      if (!append) setNotificationsError(false);
      try {
        const url = cursor
          ? `/api/notifications?limit=20&cursor=${cursor}`
          : "/api/notifications?limit=20";
        const listRes = await fetch(url, { cache: "no-store" });
        const listJson = listRes.ok ? await listRes.json().catch(() => ({})) : {};
        const rawItems = Array.isArray(listJson?.notifications) ? listJson.notifications : [];
        const mapped = rawItems
          .map((n: any) => {
            const type = String(n?.type || "");
            const id = String(n?.id || "");
            const created_at = String(n?.created_at || "");
            const read_at = n?.read_at ? String(n.read_at) : null;
            const base = {
              id,
              type,
              created_at,
              url: safeUrl(n?.url),
              read_at,
              unread: !read_at,
              title: String(n?.title || ""),
              message: String(n?.message || ""),
            };
            if (type === "pending_review") {
              const count = Number(base.message || 0);
              return {
                ...base,
                title: tNotifications("pendingReviewTitle"),
                message: tNotifications("pendingReviewMessage").replace("{count}", String(count)),
                url: "/flags",
                read_at: null,
                unread: true,
              };
            }
            const title = base.title.trim() ? base.title : titleFallbackForType(type);
            return { ...base, title };
          })
          .filter((x: any) => x.id && x.type);
        if (append) {
          setNotifications((prev) => [...prev, ...mapped]);
        } else {
          setNotifications(mapped);
        }
        const nextCursor =
          typeof listJson?.nextCursor === "string" && listJson.nextCursor
            ? String(listJson.nextCursor)
            : null;
        setNotificationsCursor(nextCursor);
        setNotificationsHasMore(Boolean(nextCursor));
      } catch {
        setNotificationsError(true);
      } finally {
        setNotificationsLoading(false);
      }
    },
    [viewerId, notificationsCursor, safeUrl, tNotifications, titleFallbackForType]
  );

  useEffect(() => {
    if (!pageVisible) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (delayMs: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void tick();
      }, delayMs);
    };
    const load = async () => {
      if (!viewerId) {
        if (!cancelled) {
          setNotificationsCount(0);
        }
        return;
      }
      try {
        const countRes = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        const countJson = countRes.ok ? await countRes.json().catch(() => ({})) : {};
        const count = Number(countJson?.count || 0);
        if (!cancelled) setNotificationsCount(Number.isFinite(count) ? count : 0);
      } catch {
        if (!cancelled) {
          setNotificationsCount(0);
        }
      }
    };
    const tick = async () => {
      if (cancelled) return;
      if (!pageVisible) return;
      if (!viewerId) {
        await load();
        return;
      }
      if (pollingInFlightRef.current) {
        schedule(2500);
        return;
      }
      pollingInFlightRef.current = true;
      try {
        await load();
      } finally {
        pollingInFlightRef.current = false;
        schedule(60000);
      }
    };
    schedule(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [viewerId, pageVisible]);

  useEffect(() => {
    if (!notificationsOpen) return;
    if (!viewerId) return;
    if (!pageVisible) return;
    setNotificationsCursor(null);
    setNotificationsHasMore(false);
    void fetchNotifications({ append: false, resetCursor: true });
  }, [notificationsOpen, viewerId, pageVisible, fetchNotifications]);

  const handleNotificationsToggle = useCallback(() => {
    if (!viewerId) return;
    if (notificationsOpen) {
      setNotificationsOpen(false);
      return;
    }
    const unreadIds = notifications
      .filter((n) => n.type !== "pending_review" && n.unread)
      .map((n) => n.id);
    void markNotificationsRead(unreadIds);
    setNotifications((prev) =>
      prev.map((n) => (n.type === "pending_review" ? n : n.unread ? { ...n, unread: false } : n))
    );
    setNotificationsOpen(true);
  }, [viewerId, notificationsOpen, notifications, markNotificationsRead]);

  const handleLoadMoreNotifications = useCallback(() => {
    if (!notificationsHasMore) return;
    if (notificationsLoading) return;
    void fetchNotifications({ append: true });
  }, [notificationsHasMore, notificationsLoading, fetchNotifications]);

  const handleReloadNotifications = useCallback(() => {
    if (!viewerId) return;
    void fetchNotifications({ append: false, resetCursor: true });
  }, [viewerId, fetchNotifications]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (!viewerId) return;
    if (markAllNotificationsLoading) return;
    setMarkAllNotificationsLoading(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.type === "pending_review"
            ? n
            : { ...n, unread: false, read_at: n.read_at || new Date().toISOString() }
        )
      );
      try {
        const countRes = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        const countJson = countRes.ok ? await countRes.json().catch(() => ({})) : {};
        const count = Number(countJson?.count || 0);
        setNotificationsCount(Number.isFinite(count) ? count : 0);
      } catch {}
    } finally {
      setMarkAllNotificationsLoading(false);
    }
  }, [viewerId, markAllNotificationsLoading]);

  const archiveIds = useCallback((ids: string[]) => {
    const numericIds = ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (!numericIds.length) return null;
    return numericIds;
  }, []);

  const handleArchiveNotification = useCallback(
    async (id: string, unread: boolean | undefined) => {
      if (!viewerId) return;
      if (archiveNotificationIdLoading) return;
      const numericIds = archiveIds([id]);
      if (!numericIds || !numericIds.length) return;
      setArchiveNotificationIdLoading(id);
      try {
        await fetch("/api/notifications/archive", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: numericIds }),
        });
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (unread) {
          try {
            const countRes = await fetch("/api/notifications/unread-count", { cache: "no-store" });
            const countJson = countRes.ok ? await countRes.json().catch(() => ({})) : {};
            const count = Number(countJson?.count || 0);
            setNotificationsCount(Number.isFinite(count) ? count : 0);
          } catch {}
        }
      } finally {
        setArchiveNotificationIdLoading(null);
      }
    },
    [viewerId, archiveNotificationIdLoading, archiveIds]
  );

  const handleArchiveAllNotifications = useCallback(async () => {
    if (!viewerId) return;
    if (archiveAllNotificationsLoading) return;
    setArchiveAllNotificationsLoading(true);
    try {
      await fetch("/api/notifications/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications([]);
      setNotificationsCursor(null);
      setNotificationsHasMore(false);
      try {
        const countRes = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        const countJson = countRes.ok ? await countRes.json().catch(() => ({})) : {};
        const count = Number(countJson?.count || 0);
        setNotificationsCount(Number.isFinite(count) ? count : 0);
      } catch {}
    } finally {
      setArchiveAllNotificationsLoading(false);
    }
  }, [viewerId, archiveAllNotificationsLoading]);

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
    if (currentWalletType === "kaia") return "Kaia";
    if (currentWalletType === "trust") return "Trust";
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
    handleNotificationsToggle,
    notificationsLoading,
    notificationsError,
    notificationsHasMore,
    handleLoadMoreNotifications,
    handleReloadNotifications,
    handleMarkAllNotificationsRead,
    markAllNotificationsLoading,
    handleArchiveNotification,
    archiveNotificationIdLoading,
    handleArchiveAllNotifications,
    archiveAllNotificationsLoading,
    notificationsFilter,
    setNotificationsFilter,
  };
}

export type TopNavBarState = ReturnType<typeof useTopNavBarLogic>;
