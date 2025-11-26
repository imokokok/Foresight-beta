"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Wallet, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import WalletModal from "./WalletModal";
import InstallPromptModal from "./InstallPromptModal";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "email" | "wallet";
}

export default function LoginModal({ open, onClose, defaultTab = "email" }: LoginModalProps) {
  const { user, requestEmailOtp, verifyEmailOtp, sendMagicLink, error } = useAuth();
  const { account, availableWallets, connectWallet, isConnecting, siweLogin, requestWalletPermissions, multisigSign } = useWallet();

  const [tab, setTab] = useState<"email" | "wallet">(defaultTab);
  const [email, setEmail] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [siweLoading, setSiweLoading] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const [installWalletName, setInstallWalletName] = useState<string>("");
  const [installUrl, setInstallUrl] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    // 登录成功后自动关闭
    if (user || account) {
      onClose();
    }
  }, [user, account, open, onClose]);

  useEffect(() => {
    if (!open) {
      setTab(defaultTab);
      setEmail("");
      setOtpRequested(false);
      setOtp("");
      setLoading(false);
    }
  }, [open, defaultTab]);

  const canRequest = useMemo(() => {
    return /.+@.+\..+/.test(email);
  }, [email]);

  const handleRequestOtp = async () => {
    if (!canRequest) return;
    setLoading(true);
    try {
      await requestEmailOtp(email);
      setOtpRequested(true);
    } catch {}
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!email || !otp) return;
    setLoading(true);
    try {
      await verifyEmailOtp(email, otp);
      onClose();
    } catch {}
    setLoading(false);
  };

  const handleSendMagicLink = async () => {
    if (!canRequest) return;
    setLoading(true);
    try {
      await sendMagicLink(email);
      setOtpRequested(true);
    } catch {}
    setLoading(false);
  };

  const installMap: Record<string, { name: string; url: string }> = {
    metamask: { name: "MetaMask", url: "https://metamask.io/download/" },
    coinbase: { name: "Coinbase Wallet", url: "https://chrome.google.com/webstore/detail/coinbase-wallet-extension/hnfanknocfeofbddgcijnmhnfnkdnaad" },
    binance: { name: "Binance Wallet", url: "https://chrome.google.com/webstore/detail/binance-wallet/fhbohimaelbohpjbbldcngcnapndodjp" },
    okx: { name: "OKX Wallet", url: "https://chrome.google.com/webstore/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge" },
  };

  const handleWalletConnect = async (walletType: string, isAvailable?: boolean) => {
    if (!isAvailable) {
      const cfg = installMap[walletType] || { name: walletType, url: "https://metamask.io/download/" };
      setInstallWalletName(cfg.name);
      setInstallUrl(cfg.url);
      setInstallPromptOpen(true);
      return;
    }
    setSelectedWallet(walletType);
    try {
      await connectWallet(walletType as any);
      setPermLoading(true);
      await requestWalletPermissions();
      setPermLoading(false);
      setSiweLoading(true);
      const res = await siweLogin();
      setSiweLoading(false);
      if (!res.success) {
        console.error('签名登录失败:', res.error);
      }
      setMultiLoading(true);
      await multisigSign();
      setMultiLoading(false);
      onClose();
    } catch (error) {
      console.error('连接钱包失败:', error);
    } finally {
      setSelectedWallet(null);
    }
  };

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const itemHeight = 80; // 约等于每个项的高度，便于计算当前位置
    setActiveIndex(Math.round(el.scrollTop / itemHeight));
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={`w-full max-w-md rounded-xl shadow-xl ${installPromptOpen ? 'bg-gradient-to-r from-purple-600/62 to-pink-600/62' : 'bg-white'}`}>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex gap-2">
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "email" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
                onClick={() => setTab("email")}
              >
                邮箱登录
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "wallet" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
                onClick={() => setTab("wallet")}
              >
                钱包登录
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-gray-100"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {tab === "email" ? (
            <div className="px-6 py-6">
              {!otpRequested ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">使用邮箱继续</h3>
                  <p className="text-sm text-gray-600">我们会发送一封包含登录链接与 6 位验证码的邮件。</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">邮箱地址</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-md border px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  {error && (
                    <div className="text-sm text-red-600">{error}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRequestOtp}
                      disabled={!canRequest || loading}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      发送验证码
                    </button>
                    <button
                      onClick={handleSendMagicLink}
                      disabled={!canRequest || loading}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-gray-900 disabled:opacity-60"
                    >
                      发送登录链接
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    继续即表示你同意我们的
                    <a href="/terms" target="_blank" className="underline ml-1">服务条款</a>
                    与
                    <a href="/privacy" target="_blank" className="underline ml-1">隐私政策</a>。
                  </p>
                  <div className="text-xs text-gray-500">也可以切换到「钱包登录」继续。</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">输入邮箱中的 6 位验证码</h3>
                  <p className="text-sm text-gray-600">我们已向 <span className="font-medium">{email}</span> 发送邮件。</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="tracking-widest text-center text-lg w-full rounded-md border px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="••••••"
                  />
                  {error && (
                    <div className="text-sm text-red-600">{error}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleVerifyOtp}
                      disabled={otp.length !== 6 || loading}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      验证并登录
                    </button>
                    <button
                      onClick={handleRequestOtp}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-gray-900"
                    >
                      重新发送
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">也可以在邮件中点击登录链接完成登录。</p>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-6 space-y-4">
              <h3 className="text-lg font-semibold">使用钱包继续</h3>
              <p className="text-sm text-gray-600">支持常见钱包（如 MetaMask、Coinbase、Binance、OKX 等）。</p>

              <div className="relative">
                <div
                  ref={listRef}
                  onScroll={onScroll}
                  className="h-56 overflow-y-auto snap-y snap-mandatory pr-2 -mr-2 scrollbar-beauty"
                >
                    {availableWallets && availableWallets.length > 0 ? (
                    availableWallets.map((wallet, index) => (
                      <button
                        key={wallet.type}
                        onClick={() => handleWalletConnect(wallet.type, wallet.isAvailable)}
                        disabled={isConnecting}
                        className={`snap-center w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 group relative overflow-hidden mb-3
                          ${wallet.isAvailable 
                            ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer hover:shadow-sm' 
                            : 'border-gray-200 bg-gray-50 opacity-60'}
                          ${selectedWallet === wallet.type ? 'border-gray-900 bg-gray-100 shadow-md' : ''}
                        `}
                        aria-label={`连接 ${wallet.name}`}
                      >
                        <div className="relative flex items-center space-x-4">
                          <div className="flex-shrink-0 p-2 bg-white rounded-xl shadow-sm">
                            <Wallet className="w-6 h-6 text-gray-900" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">{wallet.name}</div>
                            {!wallet.isAvailable ? (
                              <div className="text-sm text-red-500 font-medium">未安装</div>
                            ) : (
                              <div className="text-sm text-gray-500">点击连接</div>
                            )}
                          </div>
                        </div>

                        <div className="relative">
                          {selectedWallet === wallet.type && (isConnecting || siweLoading || permLoading || multiLoading) ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-900 border-t-transparent" />
                          ) : wallet.isAvailable ? (
                            <div className="w-6 h-6 rounded-full border-2 border-gray-300 group-hover:border-gray-900 transition-colors duration-300 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </div>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-red-400">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" fill="currentColor"/>
                            </svg>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">正在检测已安装的钱包扩展…</div>
                  )}
                </div>

                {/* 竖直滑动指示器（可选） */}
                {availableWallets && availableWallets.length > 1 && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pr-1">
                    {availableWallets.map((_, i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full ring-2 transition-all duration-200 ${i === activeIndex ? 'bg-gradient-to-r from-purple-500 to-pink-500 ring-purple-300 shadow-sm' : 'bg-gray-300 ring-transparent opacity-70'}`}
                      ></span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500">也可以切换到「邮箱登录」。</p>
            </div>
          )}
        </div>
      </div>

      {walletModalOpen && (
        <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      )}
      <InstallPromptModal open={installPromptOpen} onClose={() => setInstallPromptOpen(false)} walletName={installWalletName} installUrl={installUrl} />
    </div>
    , document.body
  );
}
