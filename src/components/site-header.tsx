import Link from "next/link";
import { getViewer } from "@/lib/session";
import { AuthButtons } from "./auth-buttons";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Wedding <span className="text-accent">Seeker</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2 text-sm sm:gap-4">
            <Link href="/search" className="hidden rounded-full px-3 py-2 text-muted hover:text-foreground sm:inline">
              Search
            </Link>
            {viewer.user ? (
              <Link href="/dashboard" className="rounded-full px-3 py-2 text-muted hover:text-foreground">
                Dashboard
              </Link>
            ) : null}
            <AuthButtons signedIn={Boolean(viewer.user)} />
          </nav>
        </div>
      </header>
      {viewer.user && !viewer.paid ? (
        <div className="border-b border-gold/30 bg-[#fbf1df] px-4 py-2 text-center text-sm text-foreground">
          See contact details, every match, Save and one-click Connect.{" "}
          <Link href="/upgrade" className="font-medium text-accent underline underline-offset-2">
            Upgrade to Wedding Seeker Plus
          </Link>
        </div>
      ) : null}
    </>
  );
}
