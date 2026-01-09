import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWalletModalLogic } from "../useWalletModalLogic";

const connectWalletMock = vi.hoisted(() => vi.fn());
const connectWalletWithResultMock = vi.hoisted(() => vi.fn());
const siweLoginMock = vi.hoisted(() => vi.fn());
const requestWalletPermissionsMock = vi.hoisted(() => vi.fn());
const multisigSignMock = vi.hoisted(() => vi.fn());

const requestEmailOtpMock = vi.hoisted(() => vi.fn());
const verifyEmailOtpMock = vi.hoisted(() => vi.fn());
const sendMagicLinkMock = vi.hoisted(() => vi.fn());

const useWalletMock = vi.hoisted(() =>
  vi.fn(() => ({
    connectWallet: connectWalletMock,
    connectWalletWithResult: connectWalletWithResultMock,
    availableWallets: [],
    isConnecting: false,
    siweLogin: siweLoginMock,
    requestWalletPermissions: requestWalletPermissionsMock,
    multisigSign: multisigSignMock,
    account: null,
    normalizedAccount: null,
  }))
);

const useAuthOptionalMock = vi.hoisted(() =>
  vi.fn(() => ({
    user: null as any,
    error: null,
    requestEmailOtp: requestEmailOtpMock,
    verifyEmailOtp: verifyEmailOtpMock,
    sendMagicLink: sendMagicLinkMock,
  }))
);

vi.mock("@/contexts/WalletContext", () => ({
  useWallet: useWalletMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuthOptional: useAuthOptionalMock,
}));

vi.mock("@/contexts/UserProfileContext", () => ({
  useUserProfileOptional: () => null,
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: (ns?: string) => {
    return (key: string) => `${ns ?? "ns"}.${key}`;
  },
}));

describe("useWalletModalLogic 邮箱登录流程", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("已登录但没有钱包地址时会自动关闭弹窗", async () => {
    const onClose = vi.fn();
    useAuthOptionalMock.mockImplementation(() => ({
      user: { id: "u1", email: "user@example.com" },
      error: null,
      requestEmailOtp: requestEmailOtpMock,
      verifyEmailOtp: verifyEmailOtpMock,
      sendMagicLink: sendMagicLinkMock,
    }));

    renderHook(() =>
      useWalletModalLogic({
        isOpen: true,
        onClose,
      })
    );

    await act(async () => {});

    expect(onClose.mock.calls.length).toBeGreaterThan(0);
  });

  it("在邮箱格式无效时不会请求 OTP", async () => {
    const { result } = renderHook(() =>
      useWalletModalLogic({
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    expect(result.current.canRequest).toBe(false);

    await act(async () => {
      await result.current.handleRequestOtp();
    });

    expect(requestEmailOtpMock).not.toHaveBeenCalled();
    expect(result.current.emailLoading).toBe(false);
    expect(result.current.otpRequested).toBe(false);
  });

  it("在邮箱有效时会调用 requestEmailOtp 并设置 otpRequested", async () => {
    requestEmailOtpMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useWalletModalLogic({
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    await act(async () => {
      result.current.setEmail("user@example.com");
    });

    expect(result.current.canRequest).toBe(true);

    await act(async () => {
      await result.current.handleRequestOtp();
    });

    expect(requestEmailOtpMock).toHaveBeenCalledTimes(1);
    expect(requestEmailOtpMock).toHaveBeenCalledWith("user@example.com");
    expect(result.current.otpRequested).toBe(true);
    expect(result.current.emailLoading).toBe(false);
  });

  it("点击发送魔法链接不会切换到 OTP 模式", async () => {
    sendMagicLinkMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useWalletModalLogic({
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    await act(async () => {
      result.current.setEmail("magic@example.com");
    });

    expect(result.current.canRequest).toBe(true);

    await act(async () => {
      await result.current.handleSendMagicLink();
    });

    expect(sendMagicLinkMock).toHaveBeenCalledTimes(1);
    expect(sendMagicLinkMock).toHaveBeenCalledWith("magic@example.com");
    expect(result.current.otpRequested).toBe(false);
    expect(result.current.emailLoading).toBe(false);
  });
});
