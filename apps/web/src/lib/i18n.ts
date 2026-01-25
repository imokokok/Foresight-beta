"use client";

import {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  createContext,
  createElement,
} from "react";
import zhCN from "../../messages/zh-CN.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import ko from "../../messages/ko.json";
import { locales, defaultLocale, type Locale } from "../i18n-config";
export type { Locale };
import type { ReactNode } from "react";
import type { Messages as MessagesType, MessageKey, Namespace } from "./i18n-types";

type Messages = typeof zhCN;

type PluralForm = "zero" | "one" | "two" | "few" | "many" | "other";

type PluralRule = (n: number) => PluralForm;

const pluralRules: Record<Locale, PluralRule> = {
  "zh-CN": () => "other",
  en: (n: number) => (n === 1 ? "one" : "other"),
  es: (n: number) => (n === 1 ? "one" : "other"),
  fr: (n: number) => {
    if (n === 0 || n === 1) return "one";
    return "other";
  },
  ko: () => "other",
};

export function getPluralForm(n: number, locale: Locale = defaultLocale): PluralForm {
  return pluralRules[locale](n);
}

export function plural(key: string, count: number, locale?: Locale): string {
  const actualLocale = locale || getCurrentLocale();
  const form = getPluralForm(count, actualLocale);
  const fullKey = `${key}.${form}`;
  const result = t(fullKey, actualLocale);

  if (result !== fullKey) {
    return formatTranslation(result, { count });
  }

  const fallbackKey = `${key}.other`;
  const fallback = t(fallbackKey, actualLocale);

  if (fallback !== fallbackKey) {
    return formatTranslation(fallback, { count });
  }

  const directResult = t(key, actualLocale);
  if (directResult !== key) {
    return formatTranslation(directResult, { count });
  }

  return key;
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: Locale
): string {
  const actualLocale = locale || getCurrentLocale();
  return new Intl.NumberFormat(actualLocale, options).format(value);
}

export function formatDate(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  const actualLocale = locale || getCurrentLocale();
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
  return new Intl.DateTimeFormat(actualLocale, options).format(date);
}

export function formatDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  const actualLocale = locale || getCurrentLocale();
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
  return new Intl.DateTimeFormat(actualLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(date);
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale?: Locale
): string {
  const actualLocale = locale || getCurrentLocale();
  return new Intl.RelativeTimeFormat(actualLocale, { numeric: "auto" }).format(value, unit);
}

export function formatCurrency(value: number, currency: string, locale?: Locale): string {
  const actualLocale = locale || getCurrentLocale();
  return formatNumber(value, { style: "currency", currency }, actualLocale);
}

export function formatPercent(value: number, locale?: Locale): string {
  const actualLocale = locale || getCurrentLocale();
  return formatNumber(value, { style: "percent" }, actualLocale);
}

function mergeMessages(base: unknown, overrides: unknown): unknown {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return base;
  if (!base || typeof base !== "object" || Array.isArray(base)) return overrides;

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    const baseValue = (base as Record<string, unknown>)[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      result[key] = mergeMessages(baseValue, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

const messages: Record<Locale, Messages> = {
  "zh-CN": zhCN,
  en: en as unknown as Messages,
  es: mergeMessages(en, es) as Messages,
  fr: mergeMessages(en, fr) as Messages,
  ko: mergeMessages(en, ko) as Messages,
};

type LocaleContextValue = { locale: Locale; setLocale: (next: Locale) => void };

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function getSupportedLocales(): Locale[] {
  return [...locales];
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

function getLocaleFromCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("preferred-language="));
  if (!raw) return null;
  const value = decodeURIComponent(raw.slice("preferred-language=".length));
  return isSupportedLocale(value) ? value : null;
}

export function getCurrentLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;

  const cookieLocale = getLocaleFromCookie();
  if (cookieLocale) return cookieLocale;

  const saved =
    typeof localStorage !== "undefined" ? localStorage.getItem("preferred-language") : null;
  if (isSupportedLocale(saved)) {
    return saved;
  }

  if (saved && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("preferred-language");
    } catch (e) {
      console.warn("[i18n] Failed to clear invalid locale from localStorage:", e);
    }
  }

  return defaultLocale;
}

export function getTranslation(locale: Locale = getCurrentLocale()): Messages {
  return messages[locale] || messages[defaultLocale];
}

export function t(key: string, locale?: Locale): string {
  const translations = getTranslation(locale);
  const keys = key.split(".");

  let value: unknown = translations;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      value = undefined;
      break;
    }
  }

  if (value === undefined) {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      try {
        console.warn("[i18n] Missing translation key:", key);
      } catch (e) {
        console.warn("[i18n] Failed to log missing translation key:", e);
      }
    }
    return key;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return String(value);
  } catch {
    return key;
  }
}

export function formatTranslation(
  template: string,
  params?: Record<string, string | number | undefined>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, rawKey: string) => {
    const v = params[rawKey];
    return v === undefined ? `{${rawKey}}` : String(v);
  });
}

export function setLocale(nextLocale: Locale) {
  if (typeof window === "undefined") return;
  if (!isSupportedLocale(nextLocale)) return;

  localStorage.setItem("preferred-language", nextLocale);

  if (typeof document !== "undefined") {
    try {
      document.cookie = `preferred-language=${encodeURIComponent(
        nextLocale
      )}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {
      console.warn("[i18n] Failed to set locale cookie:", e);
    }
  }

  window.dispatchEvent(
    new CustomEvent("languagechange", {
      detail: { locale: nextLocale },
    })
  );
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const fromCookie = getCurrentLocale();
    if (fromCookie && fromCookie !== locale) {
      setLocaleState(fromCookie);
    }

    try {
      const saved =
        typeof localStorage !== "undefined" ? localStorage.getItem("preferred-language") : null;
      if (isSupportedLocale(saved) && saved !== fromCookie && saved !== locale) {
        setLocale(saved);
        setLocaleState(saved);
      } else if (saved && typeof localStorage !== "undefined" && !isSupportedLocale(saved)) {
        localStorage.removeItem("preferred-language");
      }
    } catch (e) {
      console.warn("[i18n] Failed to read locale from localStorage:", e);
    }
  }, [locale]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "preferred-language" && e.newValue) {
        if (isSupportedLocale(e.newValue)) {
          setLocaleState(e.newValue);
        }
      }
    };

    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ locale?: string }>;
      const nextLocale = customEvent.detail?.locale;
      if (isSupportedLocale(nextLocale)) {
        setLocaleState(nextLocale);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("languagechange", handleLanguageChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("languagechange", handleLanguageChange as EventListener);
    };
  }, []);

  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale: changeLocale }), [changeLocale, locale]);

  return createElement(LocaleContext.Provider, { value }, children);
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    if (ctx) return;
    const fromCookie = getCurrentLocale();
    setLocaleState(fromCookie);

    try {
      const saved =
        typeof localStorage !== "undefined" ? localStorage.getItem("preferred-language") : null;
      if (isSupportedLocale(saved) && saved !== fromCookie) {
        setLocale(saved);
        setLocaleState(saved);
      } else if (saved && typeof localStorage !== "undefined" && !isSupportedLocale(saved)) {
        localStorage.removeItem("preferred-language");
      }
    } catch (e) {
      console.warn("[i18n] Failed to read locale from localStorage:", e);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "preferred-language" && e.newValue) {
        if (isSupportedLocale(e.newValue)) {
          setLocaleState(e.newValue);
        }
      }
    };

    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ locale?: string }>;
      const nextLocale = customEvent.detail?.locale;
      if (isSupportedLocale(nextLocale)) {
        setLocaleState(nextLocale);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("languagechange", handleLanguageChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("languagechange", handleLanguageChange as EventListener);
    };
  }, [ctx]);

  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
    setLocaleState(next);
  }, []);

  return ctx || { locale, setLocale: changeLocale };
}

export function useTranslations(namespace?: string) {
  const { locale } = useLocale();

  const translate = useCallback(
    (key: string) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return t(fullKey, locale);
    },
    [locale, namespace]
  );

  return translate;
}

export function useTypedTranslations<N extends Namespace>(namespace: N) {
  const { locale } = useLocale();

  const translate = useCallback(
    (key: keyof Messages[N] & string, params?: Record<string, string | number>) => {
      const fullKey = `${namespace}.${String(key)}` as MessageKey;
      if (params) {
        return formatTranslation(t(fullKey, locale), params);
      }
      return t(fullKey, locale);
    },
    [locale, namespace]
  );

  return translate;
}

export type { MessagesType as Messages, MessageKey, Namespace };
