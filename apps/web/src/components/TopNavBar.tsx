"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import WalletModal from "./WalletModal";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import { useTopNavBarLogic } from "./topNavBar/useTopNavBarLogic";
import { WalletSection } from "./topNavBar/WalletSection";
import { NotificationsPanel } from "./topNavBar/NotificationsPanel";
import { useLocale, useTranslations } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";

export default function TopNavBar() {
  const nav = useTopNavBarLogic();
  const { mounted, modal, walletModalOpen, setWalletModalOpen } = nav;
  const tNotifications = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const [confirmState, setConfirmState] = useState<null | {
    message: string;
    onConfirm: () => void;
  }>(null);

  const closeConfirm = useCallback(() => setConfirmState(null), []);

  const confirmBusy =
    nav.archiveAllNotificationsLoading || nav.archiveNotificationIdLoading !== null;
  const runConfirm = useCallback(() => {
    if (!confirmState || confirmBusy) return;
    const action = confirmState.onConfirm;
    closeConfirm();
    action();
  }, [closeConfirm, confirmBusy, confirmState]);

  const badgeText = useMemo(() => {
    if (!nav.notificationsCount) return "";
    if (nav.notificationsCount > 99) return "99+";
    return String(nav.notificationsCount);
  }, [nav.notificationsCount]);

  const filteredNotifications = useMemo(
    () =>
      nav.notifications.filter((item) => {
        if (nav.notificationsFilter === "all") return true;
        if (nav.notificationsFilter === "review") {
          return (
            item.type === "pending_review" ||
            item.type === "checkin_review" ||
            item.type === "flag_checkin_reminder" ||
            item.type === "forum_report" ||
            item.type === "discussion_report"
          );
        }
        if (nav.notificationsFilter === "challenge") {
          return item.type === "witness_invite";
        }
        return (
          item.type !== "pending_review" &&
          item.type !== "checkin_review" &&
          item.type !== "witness_invite" &&
          item.type !== "flag_checkin_reminder" &&
          item.type !== "forum_report" &&
          item.type !== "discussion_report"
        );
      }),
    [nav.notifications, nav.notificationsFilter]
  );

  useEffect(() => {
    if (!nav.notificationsOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (notificationsButtonRef.current?.contains(target)) return;
      if (notificationsPanelRef.current?.contains(target)) return;
      nav.setNotificationsOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      nav.setNotificationsOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [nav.notificationsOpen, nav.setNotificationsOpen]);

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
              ref={notificationsButtonRef}
              aria-label={tNotifications("ariaLabel")}
              className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/80 border border-gray-200 shadow-sm hover:bg-gray-50"
              onClick={nav.handleNotificationsToggle}
            >
              <Bell className="w-4 h-4 text-gray-700" />
              {nav.notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-center text-white">
                  {badgeText}
                </span>
              )}
            </button>
            {nav.notificationsOpen && (
              <div ref={notificationsPanelRef}>
                <NotificationsPanel
                  nav={nav}
                  filteredNotifications={filteredNotifications}
                  onArchiveOne={(id, unread) => nav.handleArchiveNotification(id, unread)}
                  onArchiveAll={() => nav.handleArchiveAllNotifications()}
                  confirmState={confirmState}
                  setConfirmState={setConfirmState}
                />
              </div>
            )}
          </div>
          <WalletSection nav={nav} />
        </div>
      </div>

      <Modal
        open={confirmState !== null}
        onClose={closeConfirm}
        role="alertdialog"
        ariaLabelledby="notifications-confirm-title"
        ariaDescribedby="notifications-confirm-desc"
      >
        <div className="bg-white rounded-xl shadow-xl p-5 w-[92vw] max-w-sm border border-gray-100">
          <h3 id="notifications-confirm-title" className="text-sm font-semibold text-gray-900">
            {tCommon("confirm")}
          </h3>
          <p
            id="notifications-confirm-desc"
            className="mt-2 text-sm text-gray-600 whitespace-pre-wrap"
          >
            {confirmState?.message || ""}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={closeConfirm}
              disabled={confirmBusy}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={runConfirm}
              disabled={confirmBusy}
            >
              {tCommon("confirm")}
            </button>
          </div>
        </div>
      </Modal>

      {mounted && modal && createPortal(modal, document.body)}

      {mounted && (
        <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      )}
    </header>
  );
}
