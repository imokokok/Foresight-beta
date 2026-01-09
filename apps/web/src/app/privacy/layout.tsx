import type { Metadata } from "next";
import type { ReactNode } from "react";
import zhCN from "../../../messages/zh-CN.json";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import ko from "../../../messages/ko.json";
import { defaultLocale, type Locale } from "../../i18n-config";
import { getServerLocale } from "@/lib/i18n-server";

type SeoMessages = (typeof zhCN)["seo"];

const seoMessages: Record<Locale, SeoMessages> = {
  "zh-CN": zhCN.seo,
  en: en.seo as SeoMessages,
  es: es.seo as SeoMessages,
  ko: ko.seo as SeoMessages,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const seo = seoMessages[locale] || seoMessages[defaultLocale];
  const privacy = (seo as any).privacy || {};

  const title =
    typeof privacy.title === "string"
      ? privacy.title
      : "Foresight Privacy Policy - Data Collection & Usage";
  const description =
    typeof privacy.description === "string"
      ? privacy.description
      : "Learn how Foresight collects, uses, and protects your personal information and usage data.";

  return {
    title,
    description,
    alternates: {
      canonical: "/privacy",
      languages: {
        "zh-CN": "/privacy",
        "en-US": "/privacy",
        "es-ES": "/privacy",
      },
    },
  };
}

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
