import type { Metadata } from "next";
import type { ReactNode } from "react";
import zhCN from "../../../messages/zh-CN.json";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import ko from "../../../messages/ko.json";
import { defaultLocale, type Locale } from "../../i18n-config";
import { getServerLocale } from "@/lib/i18n-server";
import { buildLanguageAlternates } from "@/lib/seo";

type LeaderboardMessages = (typeof zhCN)["leaderboard"];

const leaderboardMessages: Record<Locale, LeaderboardMessages> = {
  "zh-CN": zhCN.leaderboard,
  en: en.leaderboard,
  es: es.leaderboard as unknown as LeaderboardMessages,
  ko: ko.leaderboard as unknown as LeaderboardMessages,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const leaderboard = leaderboardMessages[locale] || leaderboardMessages[defaultLocale];
  const meta = (leaderboard as any).meta || {};

  const title =
    typeof meta.title === "string"
      ? meta.title
      : "Foresight Earnings Leaderboard - Top prediction traders and strategies";
  const description =
    typeof meta.description === "string"
      ? meta.description
      : "View top predictors’ historical earnings, win rates, and risk profiles on the Foresight earnings leaderboard to discover wallets with consistent profits and trading styles.";

  return {
    title,
    description,
    alternates: buildLanguageAlternates("/leaderboard"),
    openGraph: {
      title: typeof meta.ogTitle === "string" ? meta.ogTitle : title,
      description: typeof meta.ogDescription === "string" ? meta.ogDescription : description,
      url: "/leaderboard",
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

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return children;
}
