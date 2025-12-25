import React from "react";
import { Loader2, Mail } from "lucide-react";

export type WalletEmailSectionProps = {
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

export function WalletEmailSection({
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
            onChange={(e) => setOtp(e.target.value.replace(/\\D/g, ""))}
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
