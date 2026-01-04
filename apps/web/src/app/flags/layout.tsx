import type { Metadata } from "next";
import type { ReactNode } from "react";
import zhCN from "../../../messages/zh-CN.json";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import ko from "../../../messages/ko.json";
import { defaultLocale, type Locale } from "../../i18n-config";
import { getServerLocale } from "@/lib/i18n-server";
import { buildLanguageAlternates } from "@/lib/seo";

type FlagsMessages = (typeof zhCN)["flags"];

const flagsMessages: Record<Locale, FlagsMessages> = {
  "zh-CN": zhCN.flags,
  en: en.flags as unknown as FlagsMessages,
  es: es.flags as unknown as FlagsMessages,
  ko: ko.flags as unknown as FlagsMessages,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const flags = flagsMessages[locale] || flagsMessages[defaultLocale];
  const meta = (flags as any).meta || {};

  const title =
    typeof meta.title === "string"
      ? meta.title
      : "Foresight Achievement Flags - Challenge badges and growth goals";
  const description =
    typeof meta.description === "string"
      ? meta.description
      : "On the Foresight Achievement Flags page you can create and complete challenge tasks, unlock badges, and connect your personal goals with prediction markets, proposals, and community discussions.";

  return {
    title,
    description,
    alternates: buildLanguageAlternates("/flags"),
    openGraph: {
      title: typeof meta.ogTitle === "string" ? meta.ogTitle : title,
      description: typeof meta.ogDescription === "string" ? meta.ogDescription : description,
      url: "/flags",
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

export default function FlagsLayout({ children }: { children: ReactNode }) {
  return children;
}
