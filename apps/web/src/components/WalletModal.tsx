"use client";
import React from "react";
import { motion } from "framer-motion";
import { Mail, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import InstallPromptModal from "./InstallPromptModal";
import { useWalletModalLogic } from "@/hooks/useWalletModalLogic";

const walletIcons = {
  metamask: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M30.04 1.63L17.85 10.6l2.26-5.32L30.04 1.63z" fill="#E2761B" />
      <path
        d="M1.96 1.63l12.11 9.06-2.18-5.41L1.96 1.63zM25.71 23.3l-3.25 4.97 6.96 1.92 2-6.81-5.71-.08zM1.59 23.38l1.99 6.81 6.96-1.92-3.25-4.97-5.7.08z"
        fill="#E4761B"
      />
      <path
        d="M10.46 14.25L8.54 17.1l6.9.31-.23-7.42-4.75 4.26zM21.54 14.25l-4.84-4.35-.16 7.53 6.9-.31-1.9-2.87zM10.54 28.27l4.15-2.02-3.58-2.8-.57 4.82zM17.31 26.25l4.15 2.02-.57-4.82-3.58 2.8z"
        fill="#E4761B"
      />
      <path
        d="M21.46 28.27l-4.15-2.02.33 2.7-.04 1.23 3.86-1.91zM10.54 28.27l3.86 1.91-.03-1.23.33-2.7-4.16 2.02z"
        fill="#D7C1B3"
      />
      <path
        d="M14.47 21.05l-3.45-1.01 2.44-1.12 1.01 2.13zM17.53 21.05l1.01-2.13 2.45 1.12-3.46 1.01z"
        fill="#233447"
      />
      <path
        d="M10.54 28.27l.59-4.97-3.84.08 3.25 4.89zM20.87 23.3l.59 4.97 3.25-4.89-3.84-.08zM23.44 17.1l-6.9.31.64 3.64 1.01-2.13 2.45 1.12 2.8-2.94zM11.02 19.04l2.44-1.12 1.01 2.13.64-3.64-6.9-.31 2.81 2.94z"
        fill="#CD6116"
      />
      <path
        d="M8.54 17.1l2.9 5.66-.1-2.72L8.54 17.1zM20.64 19.04l-.1 2.72 2.9-5.66-2.8 2.94zM15.11 17.41l-.64 3.64.81 4.18.18-5.45-.35-2.37zM16.89 17.41l-.34 2.36.17 5.46.81-4.18-.64-3.64z"
        fill="#E4751F"
      />
      <path
        d="M17.53 21.05l-.81 4.18.58.4 3.58-2.8.1-2.72-3.45.94zM11.02 19.04l.1 2.72 3.58 2.8.58-.4-.81-4.18-3.45-.94z"
        fill="#F6851B"
      />
      <path
        d="M17.59 30.18l.04-1.23-.35-.3h-2.56l-.35.3.03 1.23-3.86-1.91 1.35 1.1 2.74 1.9h2.6l2.74-1.9 1.35-1.1-3.73 1.91z"
        fill="#C0AD9E"
      />
      <path
        d="M17.31 26.25l-.58-.4h-1.46l-.58.4-.33 2.7.35-.3h2.56l.35.3-.31-2.7z"
        fill="#161616"
      />
      <path
        d="M30.55 11.35l1.02-4.9L30.04 1.63l-12.73 9.45 4.9 4.14 6.93 2.02 1.53-1.78-.66-.48 1.06-0.97-.82-.63 1.06-.81-.7-.53zM.43 6.45l1.02 4.9-.71.53 1.06.81-.82.63 1.06.97-.66.48 1.53 1.78 6.93-2.02 4.9-4.14L1.96 1.63.43 6.45z"
        fill="#763D16"
      />
    </svg>
  ),
  coinbase: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path
        d="M16 6C10.48 6 6 10.48 6 16s4.48 10 10 10 10-4.48 10-10S21.52 6 16 6zm0 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"
        fill="white"
      />
      <rect x="12" y="14" width="8" height="4" rx="2" fill="#0052FF" />
    </svg>
  ),
  binance: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
      <path
        d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.26L16 26l-6.144-6.144 2.26-2.26zm9.764-5.596L26 16l-2.26 2.26L21.48 16l2.26-2.26z"
        fill="white"
      />
      <path d="M16 13.2l-1.8 1.8 1.8 1.8 1.8-1.8L16 13.2z" fill="white" />
    </svg>
  ),
  okx: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="16" fill="black" />
      <path
        d="M8 8h6v6H8V8zm9 0h6v6h-6V8zm9 0h6v6h-6V8zM8 17h6v6H8v-6zm9 0h6v6h-6v-6zm9 0h6v6h-6v-6z"
        fill="white"
      />
    </svg>
  ),
};

const walletNames = {
  metamask: "MetaMask",
  coinbase: "Coinbase Wallet",
  binance: "Binance Wallet",
  okx: "OKX Wallet",
};

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WalletModalLogic = ReturnType<typeof useWalletModalLogic>;

type WalletModalViewProps = WalletModalProps & Omit<WalletModalLogic, "mounted">;

const WalletModalView: React.FC<WalletModalViewProps> = ({
  isOpen,
  onClose,
  tWalletModal,
  tLogin,
  user,
  authError,
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
  setShowProfileForm,
  profileLoading,
  username,
  setUsername,
  profileError,
  rememberMe,
  setRememberMe,
  emailVerified,
  resendLeft,
  codePreview,
  installPromptOpen,
  setInstallPromptOpen,
  installWalletName,
  installUrl,
  walletStep,
  canRequest,
  canSubmitProfile,
  handleWalletConnect,
  handleRequestOtp,
  handleVerifyOtp,
  handleSendMagicLink,
  submitProfile,
  requestRegisterOtp,
  verifyRegisterOtp,
  stepHint,
  step1Active,
  step2Active,
  step3Active,
  step1Done,
  step2Done,
  step3Done,
  availableWallets,
  isConnecting,
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

type WalletModalHeaderProps = {
  tWalletModal: (key: string) => string;
  onClose: () => void;
};

function WalletModalHeader({ tWalletModal, onClose }: WalletModalHeaderProps) {
  return (
    <div className="relative flex items-center justify-between p-6 border-b border-gradient-to-r from-purple-100/50 to-pink-100/50">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
            <path
              d="M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="15,10 21,4 15,4 21,4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h2
            id="wallet-modal-title"
            className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
          >
            {tWalletModal("title")}
          </h2>
          <p id="wallet-modal-description" className="text-sm text-gray-500">
            {tWalletModal("subtitle")}
          </p>
        </div>
      </div>
      <motion.button
        onClick={onClose}
        className="p-2 hover:bg-gradient-to-br hover:from-purple-100 hover:to-pink-100 rounded-xl transition-all duration-200 group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="text-gray-400 group-hover:text-gray-600"
        >
          <path
            d="M15 5L5 15M5 5l10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </motion.button>
    </div>
  );
}

type WalletModalStepperProps = {
  tWalletModal: (key: string) => string;
  stepHint: string;
  step1Active: boolean;
  step2Active: boolean;
  step3Active: boolean;
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
};

function WalletModalStepper({
  tWalletModal,
  stepHint,
  step1Active,
  step2Active,
  step3Active,
  step1Done,
  step2Done,
  step3Done,
}: WalletModalStepperProps) {
  return (
    <div className="relative px-6 pt-3 pb-4 border-b border-purple-50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center flex-1">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full border-2 text-[11px] ${
              step1Done
                ? "border-purple-500 bg-purple-500 text-white"
                : step1Active
                  ? "border-purple-500 text-purple-600"
                  : "border-gray-200 text-gray-400"
            }`}
          >
            {step1Done ? "✓" : step1Active ? <Loader2 className="w-3 h-3 animate-spin" /> : "1"}
          </div>
          <div
            className={`ml-2 text-[11px] ${
              step1Done ? "text-purple-600" : step1Active ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {tWalletModal("steps.connectWallet")}
          </div>
          <div
            className={`flex-1 h-px mx-2 ${
              step2Done || step2Active
                ? "bg-gradient-to-r from-purple-400 to-pink-400"
                : "bg-gray-200"
            }`}
          />
        </div>
        <div className="flex items-center flex-1">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full border-2 text-[11px] ${
              step2Done
                ? "border-purple-500 bg-purple-500 text-white"
                : step2Active
                  ? "border-purple-500 text-purple-600"
                  : "border-gray-200 text-gray-400"
            }`}
          >
            {step2Done ? "✓" : step2Active ? <Loader2 className="w-3 h-3 animate-spin" /> : "2"}
          </div>
          <div
            className={`ml-2 text-[11px] ${
              step2Done ? "text-purple-600" : step2Active ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {tWalletModal("steps.signIn")}
          </div>
          <div
            className={`flex-1 h-px mx-2 ${
              step3Done || step3Active
                ? "bg-gradient-to-r from-purple-400 to-pink-400"
                : "bg-gray-200"
            }`}
          />
        </div>
        <div className="flex items-center">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full border-2 text-[11px] ${
              step3Done
                ? "border-purple-500 bg-purple-500 text-white"
                : step3Active
                  ? "border-purple-500 text-purple-600"
                  : "border-gray-200 text-gray-400"
            }`}
          >
            {step3Done ? "✓" : step3Active ? <Loader2 className="w-3 h-3 animate-spin" /> : "3"}
          </div>
          <div
            className={`ml-2 text-[11px] ${
              step3Done ? "text-purple-600" : step3Active ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {tWalletModal("steps.completeProfile")}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">{stepHint}</div>
    </div>
  );
}

type WalletProfileFormProps = {
  tWalletModal: (key: string) => string;
  tLogin: (key: string) => string;
  email: string;
  setEmail: (value: string) => void;
  otpRequested: boolean;
  otp: string;
  setOtp: (value: string) => void;
  emailLoading: boolean;
  emailVerified: boolean;
  codePreview: string | null;
  username: string;
  setUsername: (value: string) => void;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  profileError: string | null;
  canSubmitProfile: boolean;
  profileLoading: boolean;
  requestRegisterOtp: () => Promise<void>;
  verifyRegisterOtp: () => Promise<void>;
  submitProfile: () => Promise<void>;
  onClose: () => void;
};

function WalletProfileForm({
  tWalletModal,
  tLogin,
  email,
  setEmail,
  otpRequested,
  otp,
  setOtp,
  emailLoading,
  emailVerified,
  codePreview,
  username,
  setUsername,
  rememberMe,
  setRememberMe,
  profileError,
  canSubmitProfile,
  profileLoading,
  requestRegisterOtp,
  verifyRegisterOtp,
  submitProfile,
  onClose,
}: WalletProfileFormProps) {
  return (
    <div className="relative p-6 space-y-4">
      <h3 className="text-lg font-semibold">{tWalletModal("profile.title")}</h3>
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900">
          {tWalletModal("profile.usernameLabel")}
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={tWalletModal("profile.usernamePlaceholder")}
          className="w-full rounded-xl border-2 border-purple-200 bg-white/95 px-3 py-2.5 text-base text-black placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:border-purple-400"
        />
        <label className="block text-sm font-semibold text-gray-900">{tLogin("emailLabel")}</label>
        <div className="relative">
          <Mail
            className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-purple-500"
            aria-hidden="true"
          />
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-xl border-2 border-purple-200 bg-white/95 pl-10 pr-3 py-2.5 text-base text-black placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:border-purple-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={requestRegisterOtp}
            disabled={!/.+@.+\..+/.test(email) || emailLoading}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-white disabled:opacity-60"
          >
            {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {tWalletModal("profile.sendOtpWithValidity")}
          </button>
          {emailVerified && (
            <span className="text-sm text-green-600">{tWalletModal("profile.verifiedTag")}</span>
          )}
        </div>
        {otpRequested && (
          <div className="space-y-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="tracking-widest text-center text-lg w-full rounded-lg border px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="••••••"
            />
            {codePreview && (
              <div className="text-xs text-green-600">
                {tWalletModal("devCodePreviewPrefix")}
                {codePreview}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={verifyRegisterOtp}
                disabled={otp.length !== 6 || emailLoading}
                className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-white disabled:opacity-60"
              >
                {tWalletModal("profile.verifyEmail")}
              </button>
            </div>
            <div className="text-xs text-gray-500">{tWalletModal("profile.otpTip")}</div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label htmlFor="remember-me" className="text-sm text-gray-700">
            {tWalletModal("profile.rememberMe")}
          </label>
        </div>
        {profileError && <div className="text-sm text-red-600">{profileError}</div>}
        <div className="flex items-center gap-2">
          <button
            onClick={submitProfile}
            disabled={!canSubmitProfile || profileLoading}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {tWalletModal("profile.submit")}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-gray-900"
          >
            {tWalletModal("profile.later")}
          </button>
        </div>
      </div>
    </div>
  );
}

type WalletEmailSectionProps = {
  tWalletModal: (key: string) => string;
  tLogin: (key: string) => string;
  email: string;
  setEmail: (value: string) => void;
  otpRequested: boolean;
  otp: string;
  setOtp: (value: string) => void;
  emailLoading: boolean;
  authError: string | null;
  canRequest: boolean;
  handleRequestOtp: () => Promise<void>;
  handleVerifyOtp: () => Promise<void>;
  handleSendMagicLink: () => Promise<void>;
};

function WalletEmailSection({
  tWalletModal,
  tLogin,
  email,
  setEmail,
  otpRequested,
  otp,
  setOtp,
  emailLoading,
  authError,
  canRequest,
  handleRequestOtp,
  handleVerifyOtp,
  handleSendMagicLink,
}: WalletEmailSectionProps) {
  return (
    <div className="relative p-6 space-y-4">
      {!otpRequested ? (
        <div className="space-y-3">
          <label htmlFor="wallet-email" className="block text-sm font-semibold text-gray-900">
            {tLogin("emailLabel")}
          </label>
          <div className="relative">
            <Mail
              className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-purple-500"
              aria-hidden="true"
            />
            <input
              id="wallet-email"
              type="email"
              inputMode="email"
              autoFocus
              aria-label={tLogin("emailLabel")}
              aria-describedby="wallet-email-help"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tLogin("emailPlaceholder")}
              className="w-full rounded-xl border-2 border-purple-200 bg-white/95 pl-10 pr-3 py-2.5 text-base text-black placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:border-purple-400 shadow-sm hover:border-purple-300"
              spellCheck={false}
            />
          </div>
          <div id="wallet-email-help" className="text-xs text-gray-500">
            {tLogin("emailContinueDescription")}
          </div>
          {!canRequest && email.length > 0 && (
            <div className="text-xs text-red-600">{tWalletModal("profile.emailInvalid")}</div>
          )}
          {authError && <div className="text-sm text-red-600">{authError}</div>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestOtp}
              disabled={!canRequest || emailLoading}
              className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-white disabled:opacity-60"
            >
              {emailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {tLogin("sendOtp")}
            </button>
            <button
              onClick={handleSendMagicLink}
              disabled={!canRequest || emailLoading}
              className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-gray-900 disabled:opacity-60"
            >
              {tLogin("sendMagicLink")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {tLogin("otpDescriptionPrefix")} <span className="font-medium">{email}</span>
            {tLogin("otpDescriptionSuffix")}
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="tracking-widest text-center text-lg w-full rounded-lg border px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-600"
            placeholder="••••••"
          />
          {authError && <div className="text-sm text-red-600">{authError}</div>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifyOtp}
              disabled={otp.length !== 6 || emailLoading}
              className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-white disabled:opacity-60"
            >
              {emailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {tLogin("verifyAndLogin")}
            </button>
            <button
              onClick={handleRequestOtp}
              disabled={emailLoading}
              className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-gray-900"
            >
              {tLogin("resend")}
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-purple-200 to-pink-200" />
        <span className="text-xs text-gray-500">{tWalletModal("profile.or")}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-pink-200 to-purple-200" />
      </div>
    </div>
  );
}

type WalletListSectionProps = {
  tLogin: (key: string) => string;
  availableWallets: { type: string; isAvailable: boolean }[];
  selectedWallet: string | null;
  isConnecting: boolean;
  siweLoading: boolean;
  permLoading: boolean;
  multiLoading: boolean;
  handleWalletConnect: (walletType: string, isAvailable?: boolean) => Promise<void>;
};

function WalletListSection({
  tLogin,
  availableWallets,
  selectedWallet,
  isConnecting,
  siweLoading,
  permLoading,
  multiLoading,
  handleWalletConnect,
}: WalletListSectionProps) {
  return (
    <div className="relative px-6 pb-6">
      <div className="h-56 overflow-y-auto snap-y snap-mandatory pr-2 -mr-2 space-y-3 scrollbar-beauty">
        {availableWallets.map((wallet, index) => (
          <motion.button
            key={wallet.type}
            onClick={() => handleWalletConnect(wallet.type, wallet.isAvailable)}
            disabled={isConnecting}
            className={`
                    snap-center w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 group relative overflow-hidden
                    ${
                      wallet.isAvailable
                        ? "border-purple-200/50 hover:border-purple-300 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 cursor-pointer hover:shadow-lg"
                        : "border-gray-200/50 bg-gray-50/50 opacity-60"
                    }
                    ${
                      selectedWallet === wallet.type
                        ? "border-purple-400 bg-gradient-to-r from-purple-100/50 to-pink-100/50 shadow-lg"
                        : ""
                    }
                  `}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={wallet.isAvailable ? { scale: 1.02 } : {}}
            whileTap={wallet.isAvailable ? { scale: 0.98 } : {}}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>

            <div className="relative flex items-center space-x-4">
              <div className="flex-shrink-0 p-2 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow duration-300">
                {walletIcons[wallet.type as keyof typeof walletIcons]}
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors duration-300">
                  {walletNames[wallet.type as keyof typeof walletNames]}
                </div>
                {!wallet.isAvailable ? (
                  <div className="text-sm text-red-500 font-medium">{tLogin("notInstalled")}</div>
                ) : (
                  <div className="text-sm text-gray-500 group-hover:text-purple-500 transition-colors duration-300">
                    {tLogin("clickToConnect")}
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              {selectedWallet === wallet.type &&
              (isConnecting || siweLoading || permLoading || multiLoading) ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent" />
              ) : wallet.isAvailable ? (
                <div className="w-6 h-6 rounded-full border-2 border-purple-300 group-hover:border-purple-500 transition-colors duration-300 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="text-red-400"
                >
                  <path
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

type WalletModalFooterProps = {
  tLogin: (key: string) => string;
};

function WalletModalFooter({ tLogin }: WalletModalFooterProps) {
  return (
    <div className="relative px-6 pb-6">
      <div className="text-sm text-gray-500 text-center leading-relaxed">
        {tLogin("agreePrefix")}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 hover:text-purple-700 font-medium transition-colors duration-200 mx-1"
        >
          {tLogin("terms")}
        </a>
        <span className="mx-1">{tLogin("and")}</span>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 hover:text-purple-700 font-medium transition-colors duration-200 mx-1"
        >
          {tLogin("privacy")}
        </a>
        <span className="mx-1">{tLogin("agreeSuffix")}</span>
      </div>
    </div>
  );
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { mounted, ...logic } = useWalletModalLogic({ isOpen, onClose });

  if (!mounted) return null;

  return <WalletModalView isOpen={isOpen} onClose={onClose} {...logic} />;
};

export default WalletModal;
