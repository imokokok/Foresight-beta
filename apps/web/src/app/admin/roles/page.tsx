"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";

interface RoleUser {
  wallet_address: string;
  username: string | null;
  email: string | null;
  is_admin: boolean;
  is_reviewer: boolean;
  created_at: string;
}

export default function RolesPage() {
  const t = useTranslations("adminRoles");
  const tCommon = useTranslations("common");
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingWallet, setSavingWallet] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || t("loadFailed"));
        setUsers([]);
        return;
      }
      const list: RoleUser[] = Array.isArray(data?.users) ? data.users : [];
      setUsers(list);
    } catch (e: any) {
      setError(e?.message || t("loadFailed"));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleReviewer = async (wallet: string, current: boolean) => {
    if (!wallet) return;
    setSavingWallet(wallet);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet, isReviewer: !current }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message || t("updateFailed");
        alert(msg);
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.wallet_address === wallet ? { ...u, is_reviewer: !current } : u))
      );
    } catch (e: any) {
      alert(e?.message || t("updateFailed"));
    } finally {
      setSavingWallet(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-rose-50/30 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
            <p className="text-sm text-slate-500 mt-1">{t("description")}</p>
          </div>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t("refreshList")}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-600">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{t("userList")}</span>
            <span className="text-xs text-slate-400">
              {t("totalUsers").replace("{count}", String(users.length))}
            </span>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">{t("loading")}</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">{t("empty")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-500">
                      {t("walletAddress")}
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-500">
                      {t("username")}
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-500">
                      {t("email")}
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-500">
                      {t("isAdmin")}
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-500">
                      {t("isReviewer")}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-500">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.wallet_address}>
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-700">
                        {u.wallet_address || "-"}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{u.username || "-"}</td>
                      <td className="px-4 py-2 text-slate-700">{u.email || "-"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.is_admin
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-slate-50 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {u.is_admin ? tCommon("yes") : tCommon("no")}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.is_reviewer
                              ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                              : "bg-slate-50 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {u.is_reviewer ? tCommon("yes") : tCommon("no")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                            u.is_reviewer
                              ? "border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100"
                              : "border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                          } ${savingWallet && savingWallet !== u.wallet_address ? "opacity-50" : ""}`}
                          disabled={!!savingWallet}
                          onClick={() => toggleReviewer(u.wallet_address, u.is_reviewer)}
                        >
                          {savingWallet === u.wallet_address
                            ? t("saving")
                            : u.is_reviewer
                              ? t("revokeReviewer")
                              : t("grantReviewer")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
