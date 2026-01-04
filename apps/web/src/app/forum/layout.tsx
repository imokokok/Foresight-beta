import type { Metadata } from "next";
import type { ReactNode } from "react";
import zhCN from "../../../messages/zh-CN.json";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import ko from "../../../messages/ko.json";
import { defaultLocale, type Locale } from "../../i18n-config";
import { getServerLocale } from "@/lib/i18n-server";
import { buildLanguageAlternates } from "@/lib/seo";

type ForumMessages = (typeof zhCN)["forum"];

const forumMessages: Record<Locale, ForumMessages> = {
  "zh-CN": zhCN.forum,
  en: en.forum,
  es: es.forum,
  ko: ko.forum as ForumMessages,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const forum = forumMessages[locale] || forumMessages[defaultLocale];
  const meta = (forum as any).meta || {};

  const title =
    typeof meta.title === "string"
      ? meta.title
      : "Foresight Prediction Forum - Event discussions and strategy research";
  const description =
    typeof meta.description === "string"
      ? meta.description
      : "Join the Foresight forum to discuss prediction events, share data-driven trading strategies, and learn from other forecasters.";

  return {
    title,
    description,
    alternates: buildLanguageAlternates("/forum"),
    openGraph: {
      title: typeof meta.ogTitle === "string" ? meta.ogTitle : title,
      description: typeof meta.ogDescription === "string" ? meta.ogDescription : description,
      url: "/forum",
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

export default function ForumLayout({ children }: { children: ReactNode }) {
  return children;
}
