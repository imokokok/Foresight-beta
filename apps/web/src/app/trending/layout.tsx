import type { Metadata } from "next";
import type { ReactNode } from "react";
import zhCN from "../../../messages/zh-CN.json";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import ko from "../../../messages/ko.json";
import { defaultLocale, type Locale } from "../../i18n-config";
import { getServerLocale } from "@/lib/i18n-server";
import { buildLanguageAlternates } from "@/lib/seo";

type TrendingMessages = (typeof zhCN)["trending"];

const trendingMessages: Record<Locale, TrendingMessages> = {
  "zh-CN": zhCN.trending,
  en: en.trending,
  es: es.trending,
  ko: ko.trending as TrendingMessages,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const trending = trendingMessages[locale] || trendingMessages[defaultLocale];
  const meta = (trending as any).meta || {};

  const title =
    typeof meta.title === "string"
      ? meta.title
      : "Foresight Trending Markets - On-chain prediction and trading";
  const description =
    typeof meta.description === "string"
      ? meta.description
      : "Discover trending prediction markets on Foresight and trade on real-world events with transparent on-chain settlement.";

  return {
    title,
    description,
    alternates: buildLanguageAlternates("/trending"),
    openGraph: {
      title: typeof meta.ogTitle === "string" ? meta.ogTitle : title,
      description: typeof meta.ogDescription === "string" ? meta.ogDescription : description,
      url: "/trending",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: typeof meta.twitterTitle === "string" ? meta.twitterTitle : title,
      description:
        typeof meta.twitterDescription === "string" ? meta.twitterDescription : description,
    },
  };
}

export default function TrendingLayout({ children }: { children: ReactNode }) {
  return children;
}
