/**
 * 国际化配置（轻量级方案，不影响现有路由）
 */

export const locales = ["en", "zh-CN", "es", "fr", "ko"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// 语言显示名称
export const languageNames: Record<Locale, string> = {
  "zh-CN": "简体中文",
  en: "English",
  es: "Español",
  fr: "Français",
  ko: "한국어",
};

// 语言图标
export const languageFlags: Record<Locale, string> = {
  "zh-CN": "🇨🇳",
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  ko: "🇰🇷",
};
