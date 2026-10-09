import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GateModal } from "@/components/gate-modal";
import { UrlTriggers } from "@/components/url-triggers";
import { ConnectModalHost } from "@/components/connect-modal";
import { getViewer } from "@/lib/session";
import { Suspense } from "react";
import { APP_URL } from "@/lib/urls";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "Wedding Seeker — Find wedding venues and vendors near you", template: "%s · Wedding Seeker" },
  description:
    "Describe your dream wedding in your own words and get ranked matches from every venue and vendor in your area.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Suspense>
          <UrlTriggers signedIn={Boolean(viewer.user)} />
          {viewer.paid ? <ConnectModalHost /> : null}
        </Suspense>
        <GateModal googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />
      </body>
    </html>
  );
}
