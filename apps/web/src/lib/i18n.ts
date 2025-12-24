import { useState, useEffect, useCallback } from "react";
import zhCN from "../../messages/zh-CN.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

export type Locale = "zh-CN" | "en" | "es";

const messages = {
  "zh-CN": zhCN,
  en: en,
  es: es,
};

export function getCurrentLocale(): Locale {
  if (typeof window === "undefined") return "zh-CN";

  const saved = localStorage.getItem("preferred-language");
  if (saved === "zh-CN" || saved === "en" || saved === "es") {
    return saved;
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

  return "zh-CN";
}

export function getTranslation(locale: Locale = getCurrentLocale()) {
  return messages[locale] || messages["zh-CN"];
}

export function t(key: string, locale?: Locale): string {
  const translations = getTranslation(locale);
  const keys = key.split(".");

  let value: any = translations;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }

  return value || key;
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
  if (nextLocale !== "zh-CN" && nextLocale !== "en" && nextLocale !== "es") return;

  localStorage.setItem("preferred-language", nextLocale);

  window.dispatchEvent(
    new CustomEvent("languagechange", {
      detail: { locale: nextLocale },
    })
  );
}

export function useTranslations(namespace?: string) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");

  useEffect(() => {
    setLocaleState(getCurrentLocale());

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "preferred-language" && e.newValue) {
        if (e.newValue === "zh-CN" || e.newValue === "en" || e.newValue === "es") {
          setLocaleState(e.newValue);
        }
      }
    };

    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ locale?: string }>;
      const nextLocale = customEvent.detail?.locale;
      if (nextLocale === "zh-CN" || nextLocale === "en" || nextLocale === "es") {
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
