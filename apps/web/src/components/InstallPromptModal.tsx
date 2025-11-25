"use client";
import React from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  walletName: string;
  installUrl: string;
};

export default function InstallPromptModal({ open, onClose, walletName, installUrl }: Props) {
  if (!open) return null as any;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative rounded-2xl shadow-xl overflow-hidden bg-gradient-to-r from-purple-600/38 to-pink-600/38"
        style={{ width: 600, height: 488 }}
      >
        <div className="p-4 h-full">
          <div className="h-full rounded-xl bg-white/92 backdrop-blur-sm p-6 flex flex-col shadow-[0_0_32px_rgba(147,51,234,0.35)] relative">
            <div className="absolute top-3 right-3 pointer-events-none drop-shadow-[0_6px_8px_rgba(0,0,0,0.25)] rotate-6">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <defs>
                  <linearGradient id="pinMetal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f7f7f7"/>
                    <stop offset="35%" stopColor="#d9d9d9"/>
                    <stop offset="65%" stopColor="#a9a9a9"/>
                    <stop offset="100%" stopColor="#e6e6e6"/>
                  </linearGradient>
                  <radialGradient id="pinHighlight" cx="50%" cy="35%" r="55%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85"/>
                    <stop offset="40%" stopColor="#ffffff" stopOpacity="0.15"/>
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
                  </radialGradient>
                </defs>
                <circle cx="18" cy="10" r="7" fill="url(#pinMetal)"/>
                <circle cx="16" cy="8" r="5" fill="url(#pinHighlight)"/>
                <rect x="16.5" y="15" width="3" height="14" rx="1" fill="url(#pinMetal)"/>
                <path d="M17 29 L19 29 L18 34 Z" fill="#9a9a9a"/>
              </svg>
            </div>
            <div className="mb-4">
              <div className="text-xl font-semibold text-gray-900">未检测到 {walletName} 扩展</div>
              <div className="mt-2 text-sm text-gray-600">是否跳转到官方扩展安装页面以完成安装？</div>
            </div>
            <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-700 leading-relaxed">
                你可以稍后在完成安装后返回本页面继续连接钱包。为保证安全，请仅从官方渠道安装扩展。
              </div>
              <div className="mt-3 text-xs text-gray-500">提示：安装完成后请刷新页面以检测新的扩展。</div>
              <div className="mt-3 text-xs text-gray-500">
                免责声明：第三方钱包扩展由相应官方维护，本平台不对其安全性与稳定性承担责任。请确认来源，谨慎安装。
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200 transition"
              >
                否
              </button>
              <button
                onClick={() => {
                  try { window.open(installUrl, "_blank", "noopener,noreferrer"); } catch {}
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white shadow-sm hover:opacity-95 transition"
              >
                是
              </button>
            </div>
            <div className="absolute bottom-3 right-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 italic font-semibold tracking-wide">
              foresight builder
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
