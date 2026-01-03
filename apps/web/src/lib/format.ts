import type { Locale } from "../i18n-config";
import { defaultLocale } from "../i18n-config";

type LocaleInput = Locale | string | null | undefined;

function normalizeLocale(locale: LocaleInput): string {
  if (!locale) return defaultLocale;
  return String(locale);
}

export function formatDate(
  value: string | number | Date | null | undefined,
  locale?: LocaleInput,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const fmt = new Intl.DateTimeFormat(normalizeLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
  return fmt.format(date);
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale?: LocaleInput,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const fmt = new Intl.DateTimeFormat(normalizeLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
  return fmt.format(date);
}

export function formatTime(
  value: string | number | Date | null | undefined,
  locale?: LocaleInput,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const fmt = new Intl.DateTimeFormat(normalizeLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
  return fmt.format(date);
}

export function formatNumber(
  value: number | string | null | undefined,
  locale?: LocaleInput,
  options?: Intl.NumberFormatOptions
): string {
  if (value == null) return "0";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "0";
  const fmt = new Intl.NumberFormat(normalizeLocale(locale), {
    maximumFractionDigits: 2,
    ...options,
  });
  return fmt.format(num);
}

export function formatCurrency(
  value: number | string | null | undefined,
  locale?: LocaleInput,
  currency = "USD",
  options?: Intl.NumberFormatOptions
): string {
  if (value == null) return "";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "";
  const fmt = new Intl.NumberFormat(normalizeLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    ...options,
  });
  return fmt.format(num);
}

type RelativeTimeStyle = "long" | "short" | "narrow";

type RelativeTimeOptions = {
  numeric?: "always" | "auto";
  style?: RelativeTimeStyle;
};

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date;
}

function getRelativeTimeUnit(diffMs: number): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const ms = Math.abs(diffMs);
  const seconds = ms / 1000;
  if (seconds < 60) {
    const v = Math.round(diffMs / 1000);
    return { value: v, unit: "second" };
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    const v = Math.round(diffMs / (60 * 1000));
    return { value: v, unit: "minute" };
  }
  const hours = minutes / 60;
  if (hours < 24) {
    const v = Math.round(diffMs / (60 * 60 * 1000));
    return { value: v, unit: "hour" };
  }
  const days = hours / 24;
  if (days < 30) {
    const v = Math.round(diffMs / (24 * 60 * 60 * 1000));
    return { value: v, unit: "day" };
  }
  const months = days / 30;
  if (months < 12) {
    const v = Math.round(diffMs / (30 * 24 * 60 * 60 * 1000));
    return { value: v, unit: "month" };
  }
  const v = Math.round(diffMs / (365 * 24 * 60 * 60 * 1000));
  return { value: v, unit: "year" };
}

export function formatRelativeTime(
  from: string | number | Date | null | undefined,
  to: string | number | Date | null | undefined = new Date(),
  locale?: LocaleInput,
  options?: RelativeTimeOptions
): string {
  const fromDate = toDate(from);
  const toDateValue = toDate(to);
  if (!fromDate || !toDateValue) return "";
  const diffMs = fromDate.getTime() - toDateValue.getTime();
  if (diffMs === 0) {
    const rtf = new Intl.RelativeTimeFormat(normalizeLocale(locale), {
      numeric: options?.numeric ?? "auto",
      style: options?.style ?? "short",
    });
    return rtf.format(0, "second");
  }
  const { value, unit } = getRelativeTimeUnit(diffMs);
  const rtf = new Intl.RelativeTimeFormat(normalizeLocale(locale), {
    numeric: options?.numeric ?? "auto",
    style: options?.style ?? "short",
  });
  return rtf.format(value, unit);
}
