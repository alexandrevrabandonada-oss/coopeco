import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav, Header } from "@/components/layout";
import { VRBadge } from "@/components/vr-badge";
import { ProtectedRouteGate } from "@/components/protected-route-gate";
import { UIPreferencesProvider } from "@/hooks/use-ui-preferences";

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
import { SyncProvider } from "@/lib/offline/sync-provider";
import { TelemetryProvider } from "@/components/telemetry-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <UIPreferencesProvider>
          <AuthProvider>
            <TelemetryProvider>
              <SyncProvider>
                <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
                <VRBadge />
                <div className="app-wrapper">
                  <Header />
                  <main className="main-content" id="main-content">
                    <ProtectedRouteGate>{children}</ProtectedRouteGate>
                  </main>
                  <BottomNav />
                </div>
              </SyncProvider>
            </TelemetryProvider>
          </AuthProvider>
        </UIPreferencesProvider>
      </body>
    </html>
  );
}
