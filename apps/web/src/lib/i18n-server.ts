import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "../i18n-config";

async function detectFromCookie(): Promise<Locale | null> {
  try {
    const store = await cookies();
    const raw = store.get("preferred-language")?.value;
    if (!raw) return null;
    if (locales.includes(raw as Locale)) {
      return raw as Locale;
    }
  } catch {}
  return null;
}

type LanguagePart = {
  lang: string;
  q: number;
};

async function detectFromAcceptLanguage(): Promise<Locale | null> {
  try {
    const rawHeaders = await headers();
    const acceptLanguage = rawHeaders.get("accept-language");
    if (!acceptLanguage) return null;

    const parts: LanguagePart[] = acceptLanguage.split(",").map((item: string) => {
      const [lang, qValue] = item.trim().split(";q=");
      const q = qValue ? parseFloat(qValue) || 0 : 1;
      return { lang: lang.toLowerCase(), q };
    });

    parts.sort((a: LanguagePart, b: LanguagePart) => b.q - a.q);

    for (const part of parts) {
      if (part.lang.startsWith("zh")) return "zh-CN";
      if (part.lang.startsWith("en")) return "en";
      if (part.lang.startsWith("es")) return "es";
    }
  } catch {}
  return null;
}

export async function getServerLocale(): Promise<Locale> {
  const fromCookie = await detectFromCookie();
  if (fromCookie) return fromCookie;

  const fromHeader = await detectFromAcceptLanguage();
  if (fromHeader) return fromHeader;

  return defaultLocale;
}
