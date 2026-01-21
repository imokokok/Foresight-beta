import type { Metadata } from "next";
import React, { Suspense } from "react";
import "./globals.css";
import "./nprogress.css";
import { defaultLocale, type Locale } from "../i18n-config";
import { WalletProvider } from "@/contexts/WalletContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import Sidebar from "@/components/Sidebar";
import TopNavBar from "@/components/TopNavBar";
import ReactQueryProvider from "@/components/ReactQueryProvider";
import ToastProvider from "@/components/providers/ToastProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProgressBar from "@/components/ProgressBar";
import MobileBottomNav from "@/components/MobileBottomNav";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { getServerLocale } from "@/lib/i18n-server";
import { buildLanguageAlternates, safeJsonLdStringify } from "@/lib/seo";
import { OnboardingLayout } from "./OnboardingLayout";
import { LocaleProvider } from "@/lib/i18n";

// 动态加载语言文件，只加载当前语言
async function loadLanguageFile(locale: Locale): Promise<any> {
  const langMap = {
    "zh-CN": () => import("../../messages/zh-CN.json"),
    en: () => import("../../messages/en.json"),
    es: () => import("../../messages/es.json"),
    fr: () => import("../../messages/fr.json"),
    ko: () => import("../../messages/ko.json"),
  };

  const loader = langMap[locale] || langMap[defaultLocale];
  const langModule = await loader();
  return langModule.default;
}

const openGraphLocaleByLocale: Record<Locale, string> = {
  "zh-CN": "zh_CN",
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  ko: "ko_KR",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const langFile = await loadLanguageFile(locale);
  const seo = (langFile as any).seo || {};
  const root = (seo as any).root || {};

  const titleDefault =
    typeof root.titleDefault === "string"
      ? root.titleDefault
      : "Foresight - Decentralized Prediction Market";
  const description =
    typeof root.description === "string"
      ? root.description
      : "A decentralized prediction market to trade on real-world events in a secure, transparent and fair way.";

  const keywords = Array.isArray(root.keywords) ? (root.keywords as string[]) : [];
  const openGraphTitle =
    typeof root.openGraphTitle === "string" ? root.openGraphTitle : titleDefault;
  const openGraphDescription =
    typeof root.openGraphDescription === "string" ? root.openGraphDescription : description;
  const twitterTitle = typeof root.twitterTitle === "string" ? root.twitterTitle : titleDefault;
  const twitterDescription =
    typeof root.twitterDescription === "string" ? root.twitterDescription : description;

  return {
    title: {
      default: titleDefault,
      template: "%s | Foresight",
    },
    description,
    keywords,
    authors: [{ name: "Foresight Team" }],
    creator: "Foresight",
    publisher: "Foresight",
    applicationName: "Foresight",
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market"),
    alternates: buildLanguageAlternates("/trending"),
    openGraph: {
      type: "website",
      locale: openGraphLocaleByLocale[locale] || openGraphLocaleByLocale[defaultLocale],
      alternateLocale: ["en_US", "es_ES", "fr_FR", "ko_KR"],
      url: "/trending",
      title: openGraphTitle,
      description: openGraphDescription,
      siteName: "Foresight",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Foresight Preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: twitterTitle,
      description: twitterDescription,
      images: ["/twitter-image.png"],
      creator: "@ForesightMarket",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png", sizes: "32x32" }],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
    manifest: "/manifest.json",
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale}>
      <body className="overflow-x-hidden font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "Foresight",
                  url: process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market",
                  logo:
                    (process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market") +
                    "/icon-192.png",
                },
                {
                  "@type": "WebSite",
                  name: "Foresight",
                  url: process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market",
                  potentialAction: {
                    "@type": "SearchAction",
                    target:
                      (process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market") +
                      "/api/search?q={search_term_string}",
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        <WebVitalsReporter />
        <ServiceWorkerRegister />
        <ErrorBoundary level="page">
          <LocaleProvider initialLocale={locale}>
            <ReactQueryProvider>
              <AuthProvider>
                <WalletProvider>
                  <UserProfileProvider>
                    <ToastProvider />
                    <ErrorBoundary level="section">
                      <OnboardingLayout locale={locale}>
                        <div className="flex min-h-screen flex-col">
                          <ErrorBoundary level="component">
                            <TopNavBar />
                          </ErrorBoundary>
                          <div className="flex flex-1 relative">
                            <ErrorBoundary level="component">
                              <Sidebar />
                            </ErrorBoundary>
                            <div className="flex-1 min-h-screen relative bg-gradient-to-br from-violet-50 via-purple-50/20 to-fuchsia-50/30 pb-nav">
                              <div className="absolute inset-0 pointer-events-none opacity-[0.02] z-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />
                              <div className="relative z-10">
                                <ErrorBoundary level="section">{children}</ErrorBoundary>
                              </div>
                            </div>
                          </div>
                          {/* 移动端底部导航栏 */}
                          <ErrorBoundary level="component">
                            <MobileBottomNav />
                          </ErrorBoundary>
                        </div>
                      </OnboardingLayout>
                    </ErrorBoundary>
                  </UserProfileProvider>
                </WalletProvider>
              </AuthProvider>
            </ReactQueryProvider>
          </LocaleProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
