"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useWallet } from "@/contexts/WalletContext";
import { formatTranslation, useTranslations } from "@/lib/i18n";

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
  const { refreshUser } = useUser();
  const { address, disconnect } = useWallet();
  const tLogin = useTranslations("loginCallback");
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
      await refreshUser();
    } catch {}
  }, [refreshUser]);

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
            (res.status === 429
              ? tLogin("errors.tooManyRequests")
              : formatTranslation(tLogin("errors.loginFailedWithStatus"), { status: res.status }));
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
        if (address && addr && address.toLowerCase() !== addr.toLowerCase()) {
          try {
            await disconnect();
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
        setTokenState({
          status: "error",
          message: String(e?.message || tLogin("errors.loginFailed")),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, disconnect, fallbackRedirect, refreshAfterLogin, router, tLogin, token]);

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
          (res.status === 429
            ? tLogin("errors.tooManyRequests")
            : formatTranslation(tLogin("errors.sendFailedWithStatus"), { status: res.status }));
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
      setActionError(String(e?.message || tLogin("errors.sendFailed")));
    } finally {
      setSending(false);
    }
  }, [canResend, email, redirect, tLogin]);

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
            (res.status === 429
              ? tLogin("errors.tooManyRequests")
              : formatTranslation(tLogin("errors.verifyFailedWithStatus"), { status: res.status }));
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

        if (address && addr && address.toLowerCase() !== addr.toLowerCase()) {
          await disconnect();
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
        setActionError(String(e?.message || tLogin("errors.verifyFailed")));
      } finally {
        setVerifyingCode(false);
      }
    },
    [
      address,
      disconnect,
      email,
      emailOk,
      fallbackRedirect,
      refreshAfterLogin,
      router,
      tLogin,
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
      setUsernameError(tLogin("username.invalid"));
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
          (res.status === 409
            ? tLogin("username.taken")
            : formatTranslation(tLogin("errors.saveFailedWithStatus"), { status: res.status }));
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
      setUsernameError(String(e?.message || tLogin("errors.saveFailed")));
    }
  }, [fallbackRedirect, refreshAfterLogin, router, tLogin, username, usernameState]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border bg-white p-6">
        {tokenState.status === "verifying" ? (
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{tLogin("status.loggingIn")}</div>
            <div className="mt-2 text-sm text-gray-600">{tLogin("status.pleaseWait")}</div>
          </div>
        ) : usernameState.status !== "idle" ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{tLogin("username.title")}</div>
              <div className="mt-2 text-sm text-gray-600">{tLogin("username.subtitle")}</div>
            </div>

            <div className="space-y-2">
              <label htmlFor="setup-username" className="block text-sm font-medium text-gray-900">
                {tLogin("username.label")}
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
                placeholder={tLogin("username.placeholder")}
                spellCheck={false}
              />
              <div className="text-xs text-gray-600">{tLogin("username.hint")}</div>
            </div>

            {usernameError ? (
              <div className="text-sm text-red-600 text-center">{usernameError}</div>
            ) : null}

            <button
              className="w-full inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={!canSaveUsername}
              onClick={() => void handleSaveUsername()}
            >
              {usernameState.status === "saving"
                ? tLogin("username.saving")
                : tLogin("username.saveAndContinue")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{tLogin("login.title")}</div>
              <div className="mt-2 text-sm text-gray-600">
                {tokenState.status === "error" ? tokenState.message : tLogin("login.subtitle")}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-900">
                {tLogin("login.emailLabel")}
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
                {tLogin("login.codeLabel")}
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
                    aria-label={formatTranslation(tLogin("code.digitAriaLabel"), {
                      index: idx + 1,
                    })}
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
              <div className="text-xs text-gray-600 text-center">
                {formatTranslation(tLogin("code.remainingAttempts"), { count: remainingAttempts })}
              </div>
            ) : null}
            {devCodePreview ? (
              <div className="text-xs text-green-700 text-center">
                <div>{formatTranslation(tLogin("code.devPreview"), { code: devCodePreview })}</div>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                className="flex-1 inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={!canVerifyCode}
                onClick={handleVerifyCode}
              >
                {verifyingCode ? tLogin("actions.verifying") : tLogin("actions.verifyAndLogin")}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-60"
                disabled={!canResend}
                onClick={handleResend}
              >
                {resendLeft > 0
                  ? formatTranslation(tLogin("actions.resendCountdown"), { seconds: resendLeft })
                  : sending
                    ? tLogin("actions.sending")
                    : tLogin("actions.resend")}
              </button>
            </div>

            <button
              className="w-full inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 border"
              onClick={() => router.replace(fallbackRedirect)}
            >
              {tLogin("actions.back")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
