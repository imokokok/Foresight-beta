"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";

type TokenState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "ok" }
  | { status: "error"; message: string };

type UsernameState =
  | { status: "idle" }
  | { status: "editing"; walletAddress: string; email: string; signupToken?: string }
  | { status: "saving"; walletAddress: string; email: string; signupToken?: string };

function sanitizeRedirect(raw: unknown) {
  const redirectRaw = typeof raw === "string" ? raw.trim() : "";
  if (!redirectRaw) return "";
  if (redirectRaw.length > 2048) return "";
  if (!redirectRaw.startsWith("/")) return "";
  if (redirectRaw.startsWith("//")) return "";
  if (redirectRaw.includes("://")) return "";
  return redirectRaw;
}

function isValidUsername(name: string) {
  const v = String(name || "").trim();
  if (v.length < 3 || v.length > 20) return false;
  return /^\w+$/.test(v);
}

export default function LoginCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuthOptional();
  const { checkAuth, account, disconnectWallet } = useWallet();
  const token = useMemo(() => String(searchParams.get("token") || "").trim(), [searchParams]);
  const initialCodePreview = useMemo(
    () => String(searchParams.get("codePreview") || "").trim(),
    [searchParams]
  );
  const redirect = useMemo(() => sanitizeRedirect(searchParams.get("redirect")), [searchParams]);
  const fallbackRedirect = redirect || "/";

  const initialEmail = useMemo(
    () =>
      String(searchParams.get("email") || "")
        .trim()
        .toLowerCase(),
    [searchParams]
  );

  const [tokenState, setTokenState] = useState<TokenState>(
    token ? { status: "verifying" } : { status: "idle" }
  );
  const [email, setEmail] = useState<string>(initialEmail);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [devCodePreview, setDevCodePreview] = useState<string>(initialCodePreview);

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const lastAutoSubmittedCodeRef = useRef<string>("");
  const tokenVerifyInFlightRef = useRef<string | null>(null);

  const [usernameState, setUsernameState] = useState<UsernameState>({ status: "idle" });
  const [username, setUsername] = useState<string>("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const code = useMemo(() => digits.join(""), [digits]);

  const refreshAfterLogin = useCallback(async () => {
    try {
      await auth?.refreshSession();
    } catch {}
    try {
      await checkAuth();
    } catch {}
  }, [auth, checkAuth]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!token) {
        setTokenState({ status: "idle" });
        return;
      }
      if (tokenVerifyInFlightRef.current === token) return;
      tokenVerifyInFlightRef.current = token;

      try {
        setTokenState({ status: "verifying" });
        setActionError(null);
        const res = await fetch("/api/email-magic-link/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json || json?.success !== true) {
          const msg =
            json?.error?.message ||
            json?.message ||
            (res.status === 429 ? "请求过于频繁" : `登录失败: ${res.status}`);
          throw new Error(String(msg));
        }

        if (cancelled) return;
        setTokenState({ status: "ok" });
        const data = json?.data && typeof json.data === "object" ? json.data : null;
        const isNewUser = !!(data as any)?.isNewUser;
        const addr =
          typeof (data as any)?.address === "string" ? String((data as any).address) : "";
        const emailFromRes =
          typeof (data as any)?.email === "string"
            ? String((data as any).email)
                .trim()
                .toLowerCase()
            : "";
        if (account && addr && account.toLowerCase() !== addr.toLowerCase()) {
          try {
            await disconnectWallet();
          } catch {}
        }
        await refreshAfterLogin();
        if (isNewUser && addr && emailFromRes) {
          setUsernameState({ status: "editing", walletAddress: addr, email: emailFromRes });
          setEmail(emailFromRes);
          return;
        }
        router.replace(fallbackRedirect);
      } catch (e: any) {
        if (cancelled) return;
        setTokenState({ status: "error", message: String(e?.message || "登录失败") });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, disconnectWallet, fallbackRedirect, refreshAfterLogin, router, token]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setInterval(() => {
      setResendLeft((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendLeft]);

  const emailOk = /.+@.+\..+/.test(email);
  const codeOk = /^\d{6}$/.test(code);
  const canResend = emailOk && !sending && resendLeft <= 0;
  const canVerifyCode = emailOk && codeOk && !verifyingCode;

  const applyDigitsFromString = useCallback((raw: string) => {
    const onlyDigits = String(raw || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!onlyDigits) return;
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < onlyDigits.length; i++) {
      next[i] = onlyDigits[i] || "";
    }
    setDigits(next);
    const nextFocus = Math.min(5, onlyDigits.length);
    const el = inputRefs.current[nextFocus];
    if (el) {
      el.focus();
      el.select?.();
    }
  }, []);

  const focusFirstEmptyDigit = useCallback(() => {
    const idx = digits.findIndex((d) => !d);
    const target = idx >= 0 ? idx : 5;
    const el = inputRefs.current[target];
    if (el) {
      el.focus();
      el.select?.();
    }
  }, [digits]);

  const handleResend = useCallback(async () => {
    if (!canResend) return;
    setSending(true);
    setActionError(null);
    setRemainingAttempts(null);
    try {
      const res = await fetch("/api/email-magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirect }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json?.success !== true) {
        const msg =
          json?.error?.message ||
          json?.message ||
          (res.status === 429 ? "请求过于频繁" : `发送失败: ${res.status}`);
        const details = json?.error?.details;
        if (details && typeof details === "object") {
          const waitSecondsRaw =
            typeof (details as any).waitSeconds === "number"
              ? Number((details as any).waitSeconds)
              : 0;
          const waitMinutesRaw =
            typeof (details as any).waitMinutes === "number"
              ? Number((details as any).waitMinutes)
              : 0;
          const windowMinutesRaw =
            typeof (details as any).windowMinutes === "number"
              ? Number((details as any).windowMinutes)
              : 0;
          const wait = Math.max(
            0,
            Math.round(
              waitSecondsRaw ||
                (waitMinutesRaw ? waitMinutesRaw * 60 : 0) ||
                (windowMinutesRaw ? windowMinutesRaw * 60 : 0)
            )
          );
          if (wait > 0) setResendLeft(wait);
        }
        throw new Error(String(msg));
      }
      const resendAfterSec =
        typeof json?.data?.resendAfterSec === "number" ? Number(json.data.resendAfterSec) : 60;
      const left = resendAfterSec > 0 ? Math.max(1, Math.round(resendAfterSec)) : 60;
      setResendLeft(Math.min(15 * 60, left));
      if (typeof json?.data?.codePreview === "string" && json.data.codePreview.trim()) {
        setDevCodePreview(String(json.data.codePreview).trim());
      }
    } catch (e: any) {
      setActionError(String(e?.message || "发送失败"));
    } finally {
      setSending(false);
    }
  }, [canResend, email, redirect]);

  const verifyCode = useCallback(
    async (inputCode: string) => {
      if (!emailOk) return;
      if (!/^\d{6}$/.test(inputCode)) return;
      if (verifyingCode) return;
      setVerifyingCode(true);
      setActionError(null);
      setRemainingAttempts(null);
      try {
        const res = await fetch("/api/email-otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: inputCode, mode: "login" }),
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok || !json || json?.success !== true) {
          const msg =
            json?.error?.message ||
            json?.message ||
            (res.status === 429 ? "请求过于频繁" : `验证失败: ${res.status}`);
          const details = json?.error?.details;
          if (details && typeof details === "object") {
            const remainingRaw =
              typeof (details as any).remaining === "number"
                ? Number((details as any).remaining)
                : null;
            if (remainingRaw != null && Number.isFinite(remainingRaw)) {
              setRemainingAttempts(Math.max(0, Math.round(remainingRaw)));
            }
            const waitMinutesRaw =
              typeof (details as any).waitMinutes === "number"
                ? Number((details as any).waitMinutes)
                : 0;
            if (waitMinutesRaw > 0) {
              const wait = Math.round(waitMinutesRaw * 60);
              setResendLeft((prev) => Math.max(prev, wait));
            }
          }
          throw new Error(String(msg));
        }
        const data = json?.data && typeof json.data === "object" ? json.data : null;
        const isNewUser = !!(data as any)?.isNewUser;
        const addr =
          typeof (data as any)?.address === "string" ? String((data as any).address) : "";
        const signupToken =
          typeof (data as any)?.signupToken === "string" ? String((data as any).signupToken) : "";
        const emailFromRes =
          typeof (data as any)?.email === "string"
            ? String((data as any).email)
                .trim()
                .toLowerCase()
            : email;

        if (account && addr && account.toLowerCase() !== addr.toLowerCase()) {
          await disconnectWallet();
        }

        await refreshAfterLogin();
        if (isNewUser && addr && emailFromRes) {
          setUsernameState({
            status: "editing",
            walletAddress: addr,
            email: emailFromRes,
            signupToken: signupToken || undefined,
          });
          setEmail(emailFromRes);
          return;
        }
        router.replace(fallbackRedirect);
      } catch (e: any) {
        setActionError(String(e?.message || "验证失败"));
      } finally {
        setVerifyingCode(false);
      }
    },
    [
      account,
      disconnectWallet,
      email,
      emailOk,
      fallbackRedirect,
      refreshAfterLogin,
      router,
      verifyingCode,
    ]
  );

  const handleVerifyCode = useCallback(async () => {
    if (!canVerifyCode) return;
    await verifyCode(code);
  }, [canVerifyCode, code, verifyCode]);

  useEffect(() => {
    if (tokenState.status === "verifying") return;
    focusFirstEmptyDigit();
  }, [focusFirstEmptyDigit, tokenState.status]);

  useEffect(() => {
    if (tokenState.status === "verifying") return;
    if (!emailOk) return;
    if (!codeOk) return;
    if (verifyingCode) return;
    if (lastAutoSubmittedCodeRef.current === code) return;
    lastAutoSubmittedCodeRef.current = code;
    void verifyCode(code);
  }, [code, codeOk, emailOk, tokenState.status, verifyCode, verifyingCode]);

  const canSaveUsername =
    usernameState.status === "editing" && isValidUsername(username) && usernameState.email;

  const handleSaveUsername = useCallback(async () => {
    if (usernameState.status !== "editing") return;
    const addr = usernameState.walletAddress;
    const userEmail = usernameState.email;
    const signupToken = usernameState.signupToken ? String(usernameState.signupToken) : "";
    const name = String(username || "").trim();
    if (!addr || !userEmail) return;
    if (!isValidUsername(name)) {
      setUsernameError("用户名不合规：3–20 位，仅允许字母、数字与下划线");
      return;
    }

    setUsernameError(null);
    setUsernameState({
      status: "saving",
      walletAddress: addr,
      email: userEmail,
      signupToken: signupToken || undefined,
    });
    try {
      const res = signupToken
        ? await fetch("/api/email-otp/complete-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signupToken, username: name }),
          })
        : await fetch("/api/user-profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress: addr,
              username: name,
              email: userEmail,
              rememberMe: true,
            }),
          });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json || json?.success !== true) {
        const msg =
          json?.error?.message ||
          json?.message ||
          (res.status === 409 ? "用户名已被占用" : `保存失败: ${res.status}`);
        throw new Error(String(msg));
      }
      await refreshAfterLogin();
      router.replace(fallbackRedirect);
    } catch (e: any) {
      setUsernameState({
        status: "editing",
        walletAddress: addr,
        email: userEmail,
        signupToken: signupToken || undefined,
      });
      setUsernameError(String(e?.message || "保存失败"));
    }
  }, [fallbackRedirect, refreshAfterLogin, router, username, usernameState]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border bg-white p-6">
        {tokenState.status === "verifying" ? (
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">正在登录…</div>
            <div className="mt-2 text-sm text-gray-600">请稍候</div>
          </div>
        ) : usernameState.status !== "idle" ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">设置用户名</div>
              <div className="mt-2 text-sm text-gray-600">首次邮箱登录需要先设置用户名</div>
            </div>

            <div className="space-y-2">
              <label htmlFor="setup-username" className="block text-sm font-medium text-gray-900">
                用户名
              </label>
              <input
                id="setup-username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameError(null);
                }}
                className="w-full rounded-lg border px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-600"
                placeholder="例如: alice_01"
                spellCheck={false}
              />
              <div className="text-xs text-gray-600">3–20 位，仅允许字母、数字与下划线</div>
            </div>

            {usernameError ? (
              <div className="text-sm text-red-600 text-center">{usernameError}</div>
            ) : null}

            <button
              className="w-full inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={!canSaveUsername}
              onClick={() => void handleSaveUsername()}
            >
              {usernameState.status === "saving" ? "保存中…" : "保存并继续"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">登录</div>
              <div className="mt-2 text-sm text-gray-600">
                {tokenState.status === "error" ? tokenState.message : "请输入邮箱验证码完成登录"}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-900">
                邮箱
              </label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setActionError(null);
                }}
                className="w-full rounded-lg border px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-purple-600"
                placeholder="you@example.com"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-code" className="block text-sm font-medium text-gray-900">
                6 位验证码
              </label>
              <div
                className="flex items-center justify-between gap-2"
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData?.getData("text") || "";
                  applyDigitsFromString(text);
                  setActionError(null);
                }}
              >
                {Array.from({ length: 6 }).map((_, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    aria-label={`验证码第 ${idx + 1} 位`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digits[idx] || ""}
                    onChange={(e) => {
                      const v = String(e.target.value || "");
                      const digit = v.replace(/\D/g, "");
                      if (digit.length >= 2) {
                        applyDigitsFromString(digit);
                        setActionError(null);
                        return;
                      }
                      const next = digits.slice();
                      next[idx] = digit ? digit.slice(-1) : "";
                      setDigits(next);
                      setActionError(null);
                      if (digit) {
                        const el = inputRefs.current[Math.min(5, idx + 1)];
                        if (el) {
                          el.focus();
                          el.select?.();
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace") {
                        const cur = digits[idx] || "";
                        if (!cur) {
                          const prevIdx = Math.max(0, idx - 1);
                          const el = inputRefs.current[prevIdx];
                          if (el) {
                            el.focus();
                            el.select?.();
                          }
                        }
                      }
                      if (e.key === "ArrowLeft") {
                        const prevIdx = Math.max(0, idx - 1);
                        const el = inputRefs.current[prevIdx];
                        if (el) {
                          e.preventDefault();
                          el.focus();
                          el.select?.();
                        }
                      }
                      if (e.key === "ArrowRight") {
                        const nextIdx = Math.min(5, idx + 1);
                        const el = inputRefs.current[nextIdx];
                        if (el) {
                          e.preventDefault();
                          el.focus();
                          el.select?.();
                        }
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleVerifyCode();
                      }
                    }}
                    className="w-12 h-12 text-center text-lg rounded-lg border text-black focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                ))}
              </div>
            </div>

            {actionError ? (
              <div className="text-sm text-red-600 text-center">{actionError}</div>
            ) : null}
            {remainingAttempts != null ? (
              <div className="text-xs text-gray-600 text-center">{`剩余 ${remainingAttempts} 次尝试`}</div>
            ) : null}
            {devCodePreview ? (
              <div className="text-xs text-green-700 text-center">
                <div>{`开发环境验证码：${devCodePreview}`}</div>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                className="flex-1 inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={!canVerifyCode}
                onClick={handleVerifyCode}
              >
                {verifyingCode ? "验证中…" : "验证并登录"}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-60"
                disabled={!canResend}
                onClick={handleResend}
              >
                {resendLeft > 0 ? `重发（${resendLeft}s）` : sending ? "发送中…" : "重发邮件"}
              </button>
            </div>

            <button
              className="w-full inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 border"
              onClick={() => router.replace(fallbackRedirect)}
            >
              返回
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
