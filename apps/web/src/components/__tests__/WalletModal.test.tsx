import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import WalletModal from "../WalletModal";

const useWalletModalLogicMock = vi.hoisted(() =>
  vi.fn(() => ({
    mounted: true,
    tWalletModal: (key: string) => key,
    tLogin: (key: string) => key,
    user: null,
    authError: "login failed",
    walletError: null,
    selectedWallet: null,
    email: "",
    setEmail: vi.fn(),
    otpRequested: false,
    otp: "",
    setOtp: vi.fn(),
    emailLoading: false,
    siweLoading: false,
    permLoading: false,
    multiLoading: false,
    showProfileForm: false,
    setShowProfileForm: vi.fn(),
    emailVerified: false,
    codePreview: null,
    username: "",
    setUsername: vi.fn(),
    rememberMe: false,
    setRememberMe: vi.fn(),
    profileError: null,
    canSubmitProfile: false,
    profileLoading: false,
    handleWalletConnect: vi.fn(),
    canRequest: false,
    handleRequestOtp: vi.fn(),
    handleVerifyOtp: vi.fn(),
    handleSendMagicLink: vi.fn(),
    requestRegisterOtp: vi.fn(),
    verifyRegisterOtp: vi.fn(),
    handleLogout: vi.fn(),
    handleSwitchAccount: vi.fn(),
    handlePermissionFlow: vi.fn(),
    handleMultiStepAuth: vi.fn(),
    submitProfile: vi.fn(),
    stepHint: "walletModal.hints.selectLoginMethod",
    step1Active: false,
    step2Active: false,
    step3Active: false,
    step1Done: false,
    step2Done: false,
    step3Done: false,
    availableWallets: [],
    isConnecting: false,
    installPromptOpen: false,
    setInstallPromptOpen: vi.fn(),
    installWalletName: "",
    installUrl: "",
  }))
);

vi.mock("@/hooks/useWalletModalLogic", () => ({
  useWalletModalLogic: useWalletModalLogicMock,
}));

vi.mock("../walletModal/WalletModalHeader", () => ({
  WalletModalHeader: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      close
    </button>
  ),
}));

vi.mock("../walletModal/WalletModalStepper", () => ({
  WalletModalStepper: () => <div>stepper</div>,
}));

vi.mock("../walletModal/WalletEmailSection", () => ({
  WalletEmailSection: ({
    authError,
  }: {
    tWalletModal: (key: string) => string;
    tLogin: (key: string) => string;
    email: string;
    setEmail: (v: string) => void;
    otpRequested: boolean;
    otp: string;
    setOtp: (v: string) => void;
    emailLoading: boolean;
    authError: string | null;
    canRequest: boolean;
    handleRequestOtp: () => Promise<void>;
    handleVerifyOtp: () => Promise<void>;
    handleSendMagicLink: () => Promise<void>;
  }) => (
    <div>
      <span>email-section</span>
      {authError && <div role="alert">{authError}</div>}
    </div>
  ),
}));

vi.mock("../walletModal/WalletListSection", () => ({
  WalletListSection: () => <div>wallet-list</div>,
}));

vi.mock("../walletModal/WalletModalFooter", () => ({
  WalletModalFooter: () => <div>footer</div>,
}));

vi.mock("../walletModal/WalletProfileForm", () => ({
  WalletProfileForm: () => <div>profile-form</div>,
}));

vi.mock("../InstallPromptModal", () => ({
  default: () => null,
}));

describe("WalletModal 与 AuthContext 错误展示", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当 AuthContext 有错误时，在邮箱登录区域展示错误信息", () => {
    render(<WalletModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText("email-section")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("login failed");
  });
});
