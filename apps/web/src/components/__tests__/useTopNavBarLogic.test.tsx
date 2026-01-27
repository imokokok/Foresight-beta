import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTopNavBarLogic } from "../topNavBar/useTopNavBarLogic";

const accountMock = "0x1234567890123456789012345678901234567890";
let chainIdMock: string | null = "0xaa36a7";
let currentWalletTypeMock: "metamask" | "coinbase" | "okx" | "binance" | "kaia" | "trust" | null =
  "metamask";

const refreshBalanceMock = vi.fn();
const connectWalletMock = vi.fn();
const disconnectWalletMock = vi.fn();
const switchNetworkMock = vi.fn();

const tWalletMock = vi.fn((key: string) => key);
const tAuthMock = vi.fn((key: string) => key);
const tCommonMock = vi.fn((key: string) => key);
const tNotificationsMock = vi.fn((key: string) => key);

let originalFetch: any;

vi.mock("@/contexts/WalletContext", () => ({
  useWallet: () => ({
    address: accountMock,
    account: accountMock,
    isConnecting: false,
    connectError: null,
    hasProvider: true,
    chainId: chainIdMock,
    balanceEth: "1.23",
    balanceLoading: false,
    refreshBalance: refreshBalanceMock,
    connect: connectWalletMock,
    connectWallet: connectWalletMock,
    disconnectWallet: disconnectWalletMock,
    formatAddress: (addr: string) => addr,
    availableWallets: [],
    currentWalletType: currentWalletTypeMock,
    switchNetwork: switchNetworkMock,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", address: accountMock },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/contexts/UserProfileContext", () => ({
  useUserProfileOptional: () => null,
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: (ns?: string) => {
    if (ns === "wallet") return tWalletMock;
    if (ns === "auth") return tAuthMock;
    if (ns === "common") return tCommonMock;
    if (ns === "notifications") return tNotificationsMock;
    return (key: string) => key;
  },
}));

describe("useTopNavBarLogic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainIdMock = "0xaa36a7";
    currentWalletTypeMock = "metamask";
    originalFetch = (globalThis as any).fetch;
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    window.open = vi.fn();
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it("copyAddress 应该写入剪贴板并更新 copied 状态", async () => {
    const { result } = renderHook(() => useTopNavBarLogic());

    await act(async () => {
      await result.current.copyAddress();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(accountMock);
    expect(result.current.copied).toBe(true);
  });

  it("openOnExplorer 应该打开浏览器并关闭菜单", () => {
    const { result } = renderHook(() => useTopNavBarLogic());

    act(() => {
      result.current.setMenuOpen(true);
    });

    act(() => {
      result.current.openOnExplorer();
    });

    const expectedUrl = `https://etherscan.io/address/${accountMock}`;

    expect(window.open).toHaveBeenCalledWith(expectedUrl, "_blank");
    expect(result.current.menuOpen).toBe(false);
  });

  it("通知加载和切换时应该正确处理状态", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/notifications?")) {
        return {
          ok: true,
          json: async () => ({
            notifications: [
              {
                id: 1,
                type: "pending_review",
                created_at: "2024-01-01T00:00:00Z",
                message: "3",
                url: "/flags",
              },
              {
                id: 2,
                type: "witness_invite",
                created_at: "2024-01-02T00:00:00Z",
                title: "",
                message: "",
                url: "/invite",
              },
            ],
            nextCursor: null,
          }),
        } as any;
      }
      if (url === "/api/notifications/unread-count") {
        return {
          ok: true,
          json: async () => ({ count: 1 }),
        } as any;
      }
      if (url === "/api/notifications/read") {
        return {
          ok: true,
          json: async () => ({}),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as any;
    });

    (globalThis as any).fetch = fetchMock;

    const { result } = renderHook(() => useTopNavBarLogic());

    await act(async () => {
      result.current.handleReloadNotifications();
    });

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(2);
    });

    const [pendingReview, invite] = result.current.notifications;

    expect(pendingReview.type).toBe("pending_review");
    expect(pendingReview.url).toBe("/flags");
    expect(pendingReview.unread).toBe(true);

    expect(invite.type).toBe("witness_invite");
    expect(invite.title).toBe("fallbackWitnessInviteTitle");
    expect(invite.url).toBe("/invite");

    await act(async () => {
      result.current.handleNotificationsToggle();
    });

    const [pendingReviewAfter] = result.current.notifications;

    expect(pendingReviewAfter.unread).toBe(true);

    const readCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : input.toString();
      return url === "/api/notifications/read";
    });

    expect(readCall).toBeTruthy();
    const body = JSON.parse((readCall as any)[1].body as string);
    expect(body.ids).toEqual([2]);
    expect(result.current.notificationsOpen).toBe(true);
  });

  it("handleMarkAllNotificationsRead 应该标记全部为已读并更新计数", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/notifications?")) {
        return {
          ok: true,
          json: async () => ({
            notifications: [
              {
                id: 1,
                type: "pending_review",
                created_at: "2024-01-01T00:00:00Z",
                message: "2",
              },
              {
                id: 2,
                type: "system",
                created_at: "2024-01-02T00:00:00Z",
              },
            ],
            nextCursor: null,
          }),
        } as any;
      }
      if (url === "/api/notifications/read") {
        return {
          ok: true,
          json: async () => ({}),
        } as any;
      }
      if (url === "/api/notifications/unread-count") {
        return {
          ok: true,
          json: async () => ({ count: 0 }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as any;
    });

    (globalThis as any).fetch = fetchMock;

    const { result } = renderHook(() => useTopNavBarLogic());

    await act(async () => {
      result.current.handleReloadNotifications();
    });

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(2);
    });

    await act(async () => {
      await result.current.handleMarkAllNotificationsRead();
    });

    const [pendingReviewAfter, systemAfter] = result.current.notifications;

    expect(pendingReviewAfter.unread).toBe(true);
    expect(systemAfter.unread).toBe(false);

    const readAllCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : input.toString();
      return url === "/api/notifications/read";
    });

    expect(readAllCall).toBeTruthy();
    const readAllBody = JSON.parse((readAllCall as any)[1].body as string);
    expect(readAllBody.all).toBe(true);

    await waitFor(() => {
      expect(result.current.notificationsCount).toBe(0);
    });
  });

  it("handleArchiveNotification 应该归档单条通知并更新计数", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/notifications?")) {
        return {
          ok: true,
          json: async () => ({
            notifications: [
              {
                id: 1,
                type: "system",
                created_at: "2024-01-01T00:00:00Z",
                read_at: null,
              },
              {
                id: 2,
                type: "system",
                created_at: "2024-01-02T00:00:00Z",
                read_at: "2024-01-03T00:00:00Z",
              },
            ],
            nextCursor: null,
          }),
        } as any;
      }
      if (url === "/api/notifications/archive") {
        return {
          ok: true,
          json: async () => ({}),
        } as any;
      }
      if (url === "/api/notifications/unread-count") {
        return {
          ok: true,
          json: async () => ({ count: 0 }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as any;
    });

    (globalThis as any).fetch = fetchMock;

    const { result } = renderHook(() => useTopNavBarLogic());

    await act(async () => {
      result.current.handleReloadNotifications();
    });

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(2);
    });

    await act(async () => {
      await result.current.handleArchiveNotification("1", true);
    });

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(1);
    });

    expect(result.current.notifications[0].id).toBe("2");

    const archiveCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : input.toString();
      return url === "/api/notifications/archive";
    });

    expect(archiveCall).toBeTruthy();
    const archiveBody = JSON.parse((archiveCall as any)[1].body as string);
    expect(archiveBody.ids).toEqual([1]);

    await waitFor(() => {
      expect(result.current.notificationsCount).toBe(0);
    });
  });

  it("handleArchiveAllNotifications 应该清空通知并更新计数", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/notifications?")) {
        return {
          ok: true,
          json: async () => ({
            notifications: [
              {
                id: 1,
                type: "system",
                created_at: "2024-01-01T00:00:00Z",
              },
              {
                id: 2,
                type: "system",
                created_at: "2024-01-02T00:00:00Z",
              },
            ],
            nextCursor: null,
          }),
        } as any;
      }
      if (url === "/api/notifications/archive") {
        return {
          ok: true,
          json: async () => ({}),
        } as any;
      }
      if (url === "/api/notifications/unread-count") {
        return {
          ok: true,
          json: async () => ({ count: 0 }),
        } as any;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as any;
    });

    (globalThis as any).fetch = fetchMock;

    const { result } = renderHook(() => useTopNavBarLogic());

    await act(async () => {
      result.current.handleReloadNotifications();
    });

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(2);
    });

    await act(async () => {
      await result.current.handleArchiveAllNotifications();
    });

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(0);
    });

    const archiveAllCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === "string" ? input : input.toString();
      return url === "/api/notifications/archive";
    });

    expect(archiveAllCall).toBeTruthy();
    const archiveAllBody = JSON.parse((archiveAllCall as any)[1].body as string);
    expect(archiveAllBody.all).toBe(true);

    await waitFor(() => {
      expect(result.current.notificationsCount).toBe(0);
      expect(result.current.notificationsHasMore).toBe(false);
    });
  });
});
