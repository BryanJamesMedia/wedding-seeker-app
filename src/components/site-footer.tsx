import Image from "next/image";
import Link from "next/link";
import logo from "../../public/brand/wedding-seeker-logo-white.png";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-navy text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <Image src={logo} alt="Wedding Seeker" className="h-8 w-auto" />
          <p>© {new Date().getFullYear()} Wedding Seeker</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <Link href="/search" className="hover:text-white">Search</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
