"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type VerifyState = { status: "loading" } | { status: "error"; message: string } | { status: "ok" };

export default function LoginCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => String(searchParams.get("token") || "").trim(), [searchParams]);
  const [state, setState] = useState<VerifyState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!token) {
        setState({ status: "error", message: "登录链接无效或已过期" });
        return;
      }

      try {
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
        setState({ status: "ok" });
        router.replace("/");
      } catch (e: any) {
        if (cancelled) return;
        setState({ status: "error", message: String(e?.message || "登录失败") });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (state.status === "error") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-2xl border bg-white p-6 text-center">
          <div className="text-lg font-semibold text-gray-900">登录失败</div>
          <div className="mt-2 text-sm text-gray-600">{state.message}</div>
          <button
            className="mt-5 inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => router.replace("/")}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border bg-white p-6 text-center">
        <div className="text-lg font-semibold text-gray-900">正在登录…</div>
        <div className="mt-2 text-sm text-gray-600">请稍候</div>
      </div>
    </div>
  );
}
