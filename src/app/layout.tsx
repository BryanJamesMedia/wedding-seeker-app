import type { Metadata } from "next";
import { Lexend, Outfit } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GateModal } from "@/components/gate-modal";
import { UrlTriggers } from "@/components/url-triggers";
import { ConnectModalHost } from "@/components/connect-modal";
import { getViewer } from "@/lib/session";
import { Suspense } from "react";
import { APP_URL } from "@/lib/urls";
import "./globals.css";

const GTM_ID = "GTM-PZL5PWXN";
const GTM_SNIPPET = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`;
const GTM_NOSCRIPT = `<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;

const body = Outfit({ variable: "--font-body", subsets: ["latin"] });
const display = Lexend({ variable: "--font-display", subsets: ["latin"] });

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
      <head>
        <script id="google-tag-manager" dangerouslySetInnerHTML={{ __html: GTM_SNIPPET }} />
      </head>
      <body className="flex min-h-full flex-col">
        <noscript dangerouslySetInnerHTML={{ __html: GTM_NOSCRIPT }} />
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
