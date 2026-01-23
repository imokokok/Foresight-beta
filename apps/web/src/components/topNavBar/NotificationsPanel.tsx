"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { TopNavBarState } from "./useTopNavBarLogic";
import type { NotificationFilter } from "./hooks/useNotificationsLogic";

interface NotificationsPanelProps {
  nav: TopNavBarState;
  filteredNotifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    created_at: string;
    url?: string;
    unread?: boolean;
  }>;
  onArchiveOne: (id: string, unread: boolean | undefined) => void;
  onArchiveAll: () => void;
  confirmState: {
    message: string;
    onConfirm: () => void;
  } | null;
  setConfirmState: (state: {
    message: string;
    onConfirm: () => void;
  } | null) => void;
}

export function NotificationsPanel({
  nav,
  filteredNotifications,
  onArchiveOne,
  onArchiveAll,
  confirmState,
  setConfirmState,
}: NotificationsPanelProps) {
  const tNotifications = useTranslations("notifications");
  const { locale } = useLocale();

  const headerSummaryText = useMemo(() => {
    if (!nav.notificationsCount) return "";
    return tNotifications("summary").replace("{count}", String(nav.notificationsCount));
  }, [nav.notificationsCount, tNotifications]);

  return (
    <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
      <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>{tNotifications("centerTitle")}</span>
          {headerSummaryText && (
            <span className="text-[11px] font-normal text-gray-400">{headerSummaryText}</span>
          )}
          <div className="ml-2 flex items-center gap-1">
            <button
              type="button"
              className={`px-1.5 py-0.5 rounded-full border text-[11px] ${
                nav.notificationsFilter === "all"
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => nav.setNotificationsFilter("all")}
            >
              {tNotifications("filterAll")}
            </button>
            <button
              type="button"
              className={`px-1.5 py-0.5 rounded-full border text-[11px] ${
                nav.notificationsFilter === "system"
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => nav.setNotificationsFilter("system")}
            >
              {tNotifications("filterSystem")}
            </button>
            <button
              type="button"
              className={`px-1.5 py-0.5 rounded-full border text-[11px] ${
                nav.notificationsFilter === "review"
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => nav.setNotificationsFilter("review")}
            >
              {tNotifications("filterReview")}
            </button>
            <button
              type="button"
              className={`px-1.5 py-0.5 rounded-full border text-[11px] ${
                nav.notificationsFilter === "challenge"
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => nav.setNotificationsFilter("challenge")}
            >
              {tNotifications("filterChallenge")}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {nav.notificationsCount > 0 && (
            <button
              type="button"
              onClick={nav.handleMarkAllNotificationsRead}
              disabled={nav.markAllNotificationsLoading}
              className="text-[11px] font-normal text-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {nav.markAllNotificationsLoading
                ? tNotifications("markAllReadLoading")
                : tNotifications("markAllRead")}
            </button>
          )}
          {nav.notifications.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setConfirmState({
                  message: tNotifications("confirmArchiveAll"),
                  onConfirm: onArchiveAll,
                });
              }}
              disabled={nav.archiveAllNotificationsLoading}
              className="text-[11px] font-normal text-gray-500 hover:text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {nav.archiveAllNotificationsLoading
                ? tNotifications("archiveAllLoading")
                : tNotifications("archiveAll")}
            </button>
          )}
        </div>
      </div>
      {nav.notificationsLoading && nav.notifications.length === 0 && (
        <div className="px-3 py-4 text-xs text-gray-500">{tNotifications("loading")}</div>
      )}
      {!nav.notificationsLoading &&
        nav.notificationsError &&
        nav.notifications.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-500 flex items-center justify-between gap-2">
          <span>{tNotifications("loadFailed")}</span>
          <button
            type="button"
            className="text-[11px] text-blue-600 hover:text-blue-700"
            onClick={nav.handleReloadNotifications}
          >
            {tNotifications("retry")}
          </button>
        </div>
        )}
      {!nav.notificationsLoading &&
        !nav.notificationsError &&
        nav.notifications.length === 0 &&
        nav.notificationsCount === 0 && (
          <div className="px-3 py-4 text-xs text-gray-500">{tNotifications("empty")}</div>
        )}
      {!nav.notificationsLoading &&
        !nav.notificationsError &&
        nav.notifications.length > 0 &&
        filteredNotifications.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-500">{tNotifications("emptyFiltered")}</div>
        )}
      {filteredNotifications.length > 0 && (
        <div className="max-h-72 overflow-y-auto">
          {filteredNotifications.map((item) => {
            const isTaskNotification =
              item.type === "pending_review" ||
              item.type === "checkin_review" ||
              item.type === "flag_checkin_reminder";
            return (
              <Link
                key={item.id}
                href={item.url || "/flags"}
                className={`block px-3 py-2 ${
                  isTaskNotification ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
                }`}
                onClick={() => nav.setNotificationsOpen(false)}
              >
                <div className="flex items-start gap-2">
                  {isTaskNotification && (
                    <div className="mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isTaskNotification && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-[10px] font-medium text-blue-700">
                          {tNotifications("filterReview")}
                        </span>
                      )}
                      <div
                        className={`text-xs truncate ${
                          item.unread
                            ? "font-bold text-gray-900"
                            : "font-semibold text-gray-900"
                        }`}
                      >
                        {item.title}
                      </div>
                      {item.unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </div>
                    {item.message && (
                      <div className="mt-0.5 text-[11px] text-gray-600 line-clamp-2">
                        {item.message}
                      </div>
                    )}
                    <div className="mt-0.5 text-[10px] text-gray-400">
                      {formatRelativeTime(item.created_at, new Date(), locale, {
                        numeric: "auto",
                        style: "short",
                      }) || formatDateTime(item.created_at, locale)}
                    </div>
                  </div>
                  {item.type !== "pending_review" && (
                    <button
                      type="button"
                      className="ml-2 text-[11px] text-gray-400 hover:text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmState({
                          message: tNotifications("confirmArchiveOne"),
                          onConfirm: () => onArchiveOne(item.id, item.unread),
                        });
                      }}
                      disabled={nav.archiveNotificationIdLoading === item.id}
                    >
                      {tNotifications("archive")}
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
          {nav.notificationsHasMore && (
            <button
              type="button"
              className="w-full px-3 py-2 text-[11px] text-blue-600 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={nav.notificationsLoading}
              onClick={nav.handleLoadMoreNotifications}
            >
              {nav.notificationsLoading ? tNotifications("loading") : tNotifications("loadMore")}
            </button>
          )}
        </div>
      )}
      {nav.notificationsCount > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-500">
          {tNotifications("summary").replace("{count}", String(nav.notificationsCount))}
        </div>
      )}
    </div>
  );
}
