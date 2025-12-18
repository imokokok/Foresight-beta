import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import Sidebar from "@/components/Sidebar";
import TopNavBar from "@/components/TopNavBar";
import ReactQueryProvider from "@/components/ReactQueryProvider";
import ToastProvider from "@/components/providers/ToastProvider";

export const metadata: Metadata = {
  title: {
    default: "Foresight - 去中心化预测市场",
    template: "%s | Foresight",
  },
  description: "基于区块链的去中心化预测市场平台，参与各种事件预测，赢取收益。安全、透明、公平。",
  keywords: [
    "预测市场",
    "区块链",
    "Web3",
    "DeFi",
    "去中心化",
    "Polygon",
    "智能合约",
    "加密货币",
    "预言机",
  ],
  authors: [{ name: "Foresight Team" }],
  creator: "Foresight",
  publisher: "Foresight",
  applicationName: "Foresight",

  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market"),

  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    title: "Foresight - 去中心化预测市场",
    description: "参与各种事件预测，赢取收益。安全、透明、公平。",
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
    title: "Foresight - 去中心化预测市场",
    description: "参与各种事件预测，赢取收益",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <ReactQueryProvider>
          <AuthProvider>
            <WalletProvider>
              <UserProfileProvider>
                <ToastProvider />
                <div className="flex min-h-screen flex-col">
                  <TopNavBar />
                  <div className="flex flex-1 relative">
                    <Sidebar />
                    <div className="flex-1 min-h-screen relative bg-gradient-to-br from-violet-50 via-purple-50/20 to-fuchsia-50/30">
                      <div className="absolute inset-0 pointer-events-none opacity-[0.02] z-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />
                      <div className="relative z-10">{children}</div>
                    </div>
                  </div>
                </div>
              </UserProfileProvider>
            </WalletProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
