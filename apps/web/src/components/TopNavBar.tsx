"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import Link from "next/link";
import WalletModal from "./WalletModal";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import { useTopNavBarLogic } from "./topNavBar/useTopNavBarLogic";
import { WalletSection } from "./topNavBar/WalletSection";
import { useTranslations } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";

export default function TopNavBar() {
  const nav = useTopNavBarLogic();
  const { mounted, modal, walletModalOpen, setWalletModalOpen } = nav;
  const tNotifications = useTranslations("notifications");

  const badgeText = useMemo(() => {
    if (!nav.notificationsCount) return "";
    if (nav.notificationsCount > 99) return "99+";
    return String(nav.notificationsCount);
  }, [nav.notificationsCount]);

  return (
    <header role="banner" className="fixed top-0 left-0 right-0 w-full z-50 pointer-events-none">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="lg:hidden pointer-events-auto">
          <MobileMenu />
        </div>

        <div className="ml-auto flex items-center space-x-3 pointer-events-auto">
          <LanguageSwitcher />
          <div className="relative">
            <button
              type="button"
              aria-label={tNotifications("ariaLabel")}
              className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/80 border border-gray-200 shadow-sm hover:bg-gray-50"
              onClick={() => nav.setNotificationsOpen((v) => !v)}
            >
              <Bell className="w-4 h-4 text-gray-700" />
              {nav.notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-center text-white">
                  {badgeText}
                </span>
              )}
            </button>
            {nav.notificationsOpen && (
              <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500">
                  {tNotifications("centerTitle")}
                </div>
                {nav.notifications.length === 0 && nav.notificationsCount === 0 && (
                  <div className="px-3 py-4 text-xs text-gray-500">{tNotifications("empty")}</div>
                )}
                {nav.notifications.length > 0 && (
                  <div className="max-h-72 overflow-y-auto">
                    {nav.notifications.map((item) => (
                      <Link
                        key={item.id}
                        href={item.url || "/flags"}
                        className="block px-3 py-2 hover:bg-gray-50"
                        onClick={() => nav.setNotificationsOpen(false)}
                      >
                        <div className="text-xs font-semibold text-gray-900 truncate">
                          {item.title}
                        </div>
                        {item.message && (
                          <div className="mt-0.5 text-[11px] text-gray-600 line-clamp-2">
                            {item.message}
                          </div>
                        )}
                        <div className="mt-0.5 text-[10px] text-gray-400">
                          {formatDateTime(item.created_at)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {nav.notificationsCount > 0 && (
                  <div className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-500">
                    {tNotifications("summary").replace("{count}", String(nav.notificationsCount))}
                  </div>
                )}
              </div>
            )}
          </div>
          <WalletSection nav={nav} />
        </div>
      </div>

      {mounted && modal && createPortal(modal, document.body)}

      {mounted && (
        <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      )}
    </header>
  );
}
