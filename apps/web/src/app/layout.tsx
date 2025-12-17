import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import Sidebar from "@/components/Sidebar";
import TopNavBar from "@/components/TopNavBar";
import ReactQueryProvider from "@/components/ReactQueryProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <AuthProvider>
            <WalletProvider>
              <UserProfileProvider>
                <div className="flex min-h-screen flex-col">
                  <TopNavBar />
                  <div className="flex flex-1 relative">
                    <Sidebar />
                    <div className="flex-1 min-h-screen relative bg-gradient-to-br from-violet-50 via-purple-50/30 to-fuchsia-50">
                      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />
                      <div className="relative z-0">{children}</div>
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
