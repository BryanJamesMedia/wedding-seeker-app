import Image from "next/image";
import Link from "next/link";
import logo from "../../public/brand/wedding-seeker-logo-black.png";
import { getViewer } from "@/lib/session";
import { AuthButtons } from "./auth-buttons";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="shrink-0">
            <Image src={logo} alt="Wedding Seeker" className="h-8 w-auto sm:h-9" preload />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2 text-sm sm:gap-4">
            <Link href="/search" className="hidden rounded-full px-3 py-2 font-medium text-foreground hover:text-accent sm:inline">
              Search
            </Link>
            {viewer.user ? (
              <Link href="/dashboard" className="rounded-full px-3 py-2 font-medium text-foreground hover:text-accent">
                Dashboard
              </Link>
            ) : null}
            <AuthButtons signedIn={Boolean(viewer.user)} />
          </nav>
        </div>
      </header>
      {viewer.user && !viewer.paid ? (
        <div className="bg-accent px-4 py-2 text-center text-sm text-white">
          See contact details, every match, Save and one-click Connect.{" "}
          <Link href="/upgrade" className="font-semibold text-white underline underline-offset-2">
            Upgrade to Wedding Seeker Plus
          </Link>
        </div>
      ) : null}
    </>
  );
}
