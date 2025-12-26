import { useState, useEffect, useCallback } from "react";
import zhCN from "../../messages/zh-CN.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { locales, defaultLocale, type Locale } from "../i18n-config";

type Messages = typeof zhCN;

const messages: Record<Locale, Messages> = {
  "zh-CN": zhCN,
  en,
  es,
};

export function getSupportedLocales(): Locale[] {
  return [...locales];
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function getCurrentLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;

  const saved =
    typeof localStorage !== "undefined" ? localStorage.getItem("preferred-language") : null;
  if (isSupportedLocale(saved)) {
    return saved;
  }

  if (saved && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("preferred-language");
    } catch {}
  }

  if (typeof navigator !== "undefined") {
    const navLang =
      (Array.isArray((navigator as any).languages) && (navigator as any).languages[0]) ||
      navigator.language;
    if (navLang) {
      const lower = navLang.toLowerCase();
      if (lower.startsWith("zh")) {
        return "zh-CN";
      }
      if (lower.startsWith("en")) {
        return "en";
      }
      if (lower.startsWith("es")) {
        return "es";
      }
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
      } catch {}
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
    } catch {}
  }

  window.dispatchEvent(
    new CustomEvent("languagechange", {
      detail: { locale: nextLocale },
    })
  );
}

export function useTranslations(namespace?: string) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    setLocaleState(getCurrentLocale());

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

  const translate = useCallback(
    (key: string) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return t(fullKey, locale);
    },
    [locale, namespace]
  );

  return translate;
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    setLocaleState(getCurrentLocale());

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "preferred-language" && e.newValue && isSupportedLocale(e.newValue)) {
        setLocaleState(e.newValue);
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
  }, []);

  return { locale, setLocale: changeLocale };
}

export type { Locale };
