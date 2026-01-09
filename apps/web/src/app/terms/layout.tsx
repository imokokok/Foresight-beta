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
  const terms = (seo as any).terms || {};

  const title =
    typeof terms.title === "string"
      ? terms.title
      : "Foresight Terms of Service - Agreement & Risk Disclosures";
  const description =
    typeof terms.description === "string"
      ? terms.description
      : "Read the Foresight terms to understand platform rules, eligibility requirements, risk disclosures, and liability limits.";

  const openGraphTitle = typeof terms.openGraphTitle === "string" ? terms.openGraphTitle : title;
  const openGraphDescription =
    typeof terms.openGraphDescription === "string" ? terms.openGraphDescription : description;
  const twitterTitle = typeof terms.twitterTitle === "string" ? terms.twitterTitle : title;
  const twitterDescription =
    typeof terms.twitterDescription === "string" ? terms.twitterDescription : description;

  return {
    title,
    description,
    alternates: {
      canonical: "/terms",
      languages: {
        "zh-CN": "/terms",
        "en-US": "/terms",
        "es-ES": "/terms",
      },
    },
    openGraph: {
      title: openGraphTitle,
      description: openGraphDescription,
      url: "/terms",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: twitterTitle,
      description: twitterDescription,
    },
  };
}

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children;
}
