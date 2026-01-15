import { Loader2, Mail } from "lucide-react";

export type WalletEmailSectionProps = {
  tWalletModal: (key: string) => string;
  tLogin: (key: string) => string;
  email: string;
  setEmail: (value: string) => void;
  otpRequested: boolean;
  otp: string;
  setOtp: (value: string) => void;
  codePreview: string | null;
  emailLoading: boolean;
  authError: string | null;
  canRequest: boolean;
  handleRequestOtp: () => Promise<void>;
  handleVerifyOtp: () => Promise<void>;
  handleSendMagicLink: () => Promise<void>;
  requireUsername?: boolean;
  username?: string;
  setUsername?: (value: string) => void;
  completeSignup?: () => Promise<void>;
};

export function WalletEmailSection({
  tWalletModal,
  tLogin,
  email,
  setEmail,
  otpRequested,
  otp,
  setOtp,
  codePreview,
  emailLoading,
  authError,
  canRequest,
  handleRequestOtp,
  handleVerifyOtp,
  handleSendMagicLink,
  requireUsername,
  username,
  setUsername,
  completeSignup,
}: WalletEmailSectionProps) {
  if (requireUsername) {
    return (
      <div className="relative p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">验证成功</h3>
          <p className="text-sm text-gray-600">请设置您的用户名以完成注册</p>
        </div>

        <div className="space-y-3 pt-2">
          <label className="block text-sm font-semibold text-gray-900">
            {tWalletModal("profile.usernameLabel")}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername?.(e.target.value)}
            placeholder={tWalletModal("profile.usernamePlaceholder")}
            className="w-full rounded-xl border-2 border-purple-200 bg-white/95 px-3 py-2.5 text-base text-black placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:border-purple-400"
            autoFocus
          />
          {authError && <div className="text-sm text-red-600">{authError}</div>}

          <button
            onClick={completeSignup}
            disabled={!username || emailLoading}
            className="w-full inline-flex justify-center items-center gap-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 hover:opacity-90 transition-all font-semibold disabled:opacity-60"
          >
            {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            完成注册并登录
          </button>
        </div>
      </div>
    );
  }

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
              onClick={handleSendMagicLink}
              disabled={!canRequest || emailLoading}
              className="w-full inline-flex justify-center items-center gap-2 rounded-md bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 px-4 py-2 disabled:opacity-60 hover:from-purple-400 hover:to-pink-400 hover:text-white transition-all font-semibold"
            >
              {emailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
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
          {codePreview ? (
            <div className="text-xs text-green-600">
              {tWalletModal("devCodePreviewPrefix")}
              {codePreview}
            </div>
          ) : (
            <div className="text-xs text-gray-500">{tWalletModal("profile.otpTip")}</div>
          )}
          {authError && <div className="text-sm text-red-600">{authError}</div>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifyOtp}
              disabled={otp.length !== 6 || emailLoading}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 px-4 py-2 disabled:opacity-60 hover:from-purple-400 hover:to-pink-400 hover:text-white transition-all"
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
