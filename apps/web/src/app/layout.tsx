import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <WalletProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 min-h-screen bg-white">
                <Breadcrumbs />
                {children}
              </div>
            </div>
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
