import type { Metadata } from "next";
import { locales, type Locale } from "../i18n-config";

const hrefLangByLocale: Record<Locale, string> = {
  "zh-CN": "zh-CN",
  en: "en-US",
  es: "es-ES",
  ko: "ko-KR",
};

export function buildLanguageAlternates(path: string): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    const hrefLang = hrefLangByLocale[locale];
    if (hrefLang) {
      languages[hrefLang] = path;
    }
  }
  return {
    canonical: path,
    languages,
  };
}
