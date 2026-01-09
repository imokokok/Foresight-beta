import React from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import InstallPromptModal from "../InstallPromptModal";
import { WalletEmailSection } from "./WalletEmailSection";
import { WalletListSection } from "./WalletListSection";
import { WalletModalFooter } from "./WalletModalFooter";
import { WalletModalHeader } from "./WalletModalHeader";
import { WalletModalStepper } from "./WalletModalStepper";
import { WalletProfileForm } from "./WalletProfileForm";

export type WalletModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export type WalletModalViewProps = WalletModalProps & {
  tWalletModal: (key: string) => string;
  tLogin: (key: string) => string;
  user: any;
  authError: string | null;
  walletError: string | null;
  selectedWallet: string | null;
  email: string;
  setEmail: (value: string) => void;
  otpRequested: boolean;
  otp: string;
  setOtp: (value: string) => void;
  emailLoading: boolean;
  siweLoading: boolean;
  permLoading: boolean;
  multiLoading: boolean;
  showProfileForm: boolean;
  setShowProfileForm: (value: boolean) => void;
  emailVerified: boolean;
  codePreview: string | null;
  username: string;
  setUsername: (value: string) => void;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  profileError: string | null;
  canSubmitProfile: boolean;
  profileLoading: boolean;
  handleWalletConnect: (walletType: string, isAvailable?: boolean) => Promise<void>;
  canRequest: boolean;
  handleRequestOtp: () => Promise<void>;
  handleVerifyOtp: () => Promise<void>;
  handleSendMagicLink: () => Promise<void>;
  requestRegisterOtp: () => Promise<void>;
  verifyRegisterOtp: () => Promise<void>;
  handleLogout: () => Promise<void>;
  handleSwitchAccount: () => Promise<void>;
  handlePermissionFlow: (walletType: string) => Promise<void>;
  handleMultiStepAuth: (walletType: string) => Promise<void>;
  submitProfile: () => Promise<void>;
  stepHint: string;
  step1Active: boolean;
  step2Active: boolean;
  step3Active: boolean;
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
  availableWallets: { type: string; isAvailable: boolean }[];
  isConnecting: boolean;
  installPromptOpen: boolean;
  setInstallPromptOpen: (value: boolean) => void;
  installWalletName: string;
  installUrl: string;
};

export const WalletModalView: React.FC<WalletModalViewProps> = ({
  isOpen,
  onClose,
  tWalletModal,
  tLogin,
  authError,
  walletError,
  selectedWallet,
  email,
  setEmail,
  otpRequested,
  otp,
  setOtp,
  emailLoading,
  siweLoading,
  permLoading,
  multiLoading,
  showProfileForm,
  emailVerified,
  codePreview,
  username,
  setUsername,
  rememberMe,
  setRememberMe,
  profileError,
  canSubmitProfile,
  profileLoading,
  canRequest,
  handleWalletConnect,
  handleRequestOtp,
  handleVerifyOtp,
  handleSendMagicLink,
  requestRegisterOtp,
  verifyRegisterOtp,
  submitProfile,
  stepHint,
  step1Active,
  step2Active,
  step3Active,
  step1Done,
  step2Done,
  step3Done,
  availableWallets,
  isConnecting,
  installPromptOpen,
  setInstallPromptOpen,
  installWalletName,
  installUrl,
}) => {
  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        size="fullscreen"
        ariaLabelledby="wallet-modal-title"
        ariaDescribedby="wallet-modal-description"
        backdropClassName="bg-gradient-to-br from-black/40 via-purple-900/20 to-pink-900/20 backdrop-blur-md"
        containerClassName="flex items-center justify-center px-4"
      >
        <motion.div
          className="relative bg-gradient-to-br from-white via-white to-purple-50/50 rounded-3xl shadow-2xl w-full max-w-md mx-auto overflow-hidden border border-white/20 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-2xl"></div>

          <WalletModalHeader tWalletModal={tWalletModal} onClose={onClose} />

          <WalletModalStepper
            tWalletModal={tWalletModal}
            stepHint={stepHint}
            step1Active={step1Active}
            step2Active={step2Active}
            step3Active={step3Active}
            step1Done={step1Done}
            step2Done={step2Done}
            step3Done={step3Done}
          />

          {showProfileForm ? (
            <WalletProfileForm
              tWalletModal={tWalletModal}
              tLogin={tLogin}
              email={email}
              setEmail={setEmail}
              otpRequested={otpRequested}
              otp={otp}
              setOtp={setOtp}
              emailLoading={emailLoading}
              emailVerified={emailVerified}
              codePreview={codePreview}
              username={username}
              setUsername={setUsername}
              rememberMe={rememberMe}
              setRememberMe={setRememberMe}
              profileError={profileError}
              canSubmitProfile={canSubmitProfile}
              profileLoading={profileLoading}
              requestRegisterOtp={requestRegisterOtp}
              verifyRegisterOtp={verifyRegisterOtp}
              submitProfile={submitProfile}
              onClose={onClose}
            />
          ) : (
            <>
              <WalletEmailSection
                tWalletModal={tWalletModal}
                tLogin={tLogin}
                email={email}
                setEmail={setEmail}
                otpRequested={otpRequested}
                otp={otp}
                setOtp={setOtp}
                emailLoading={emailLoading}
                authError={authError}
                canRequest={canRequest}
                handleRequestOtp={handleRequestOtp}
                handleVerifyOtp={handleVerifyOtp}
                handleSendMagicLink={handleSendMagicLink}
              />
              <WalletListSection
                tLogin={tLogin}
                availableWallets={availableWallets}
                selectedWallet={selectedWallet}
                isConnecting={isConnecting}
                siweLoading={siweLoading}
                permLoading={permLoading}
                multiLoading={multiLoading}
                walletError={walletError}
                handleWalletConnect={handleWalletConnect}
              />
            </>
          )}

          <WalletModalFooter tLogin={tLogin} />
        </motion.div>
      </Modal>
      <InstallPromptModal
        key="install-prompt-modal"
        open={installPromptOpen}
        onClose={() => setInstallPromptOpen(false)}
        walletName={installWalletName}
        installUrl={installUrl}
      />
    </>
  );
};
