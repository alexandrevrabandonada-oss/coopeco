import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav, Header } from "@/components/layout";
import { VRBadge } from "@/components/vr-badge";
import { ProtectedRouteGate } from "@/components/protected-route-gate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ECO - Rede Social do Bem",
  description: "Coleta sob demanda e rede social sustentável.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ECO",
  },
};

import { AuthProvider } from "@/contexts/auth-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <VRBadge />
          <div className="app-wrapper">
            <Header />
            <main className="main-content">
              <ProtectedRouteGate>{children}</ProtectedRouteGate>
            </main>
            <BottomNav />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
