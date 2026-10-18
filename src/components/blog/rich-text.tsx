import Link from "next/link";
import type { ReactNode } from "react";

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

function safeHref(href: string): string | null {
  return /^(\/(?!\/)|https?:\/\/|mailto:|tel:|#)/i.test(href) ? href : null;
}

/** Renders **bold**, *italic* and [links](/path) inside blog text. Everything else is plain text. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return link[1];
      const className = "font-medium text-accent underline underline-offset-2 hover:text-accent-strong";
      return href.startsWith("/") || href.startsWith("#") ? (
        <Link key={i} href={href} className={className}>{link[1]}</Link>
      ) : (
        <a key={i} href={href} className={className} target="_blank" rel="noopener noreferrer">{link[1]}</a>
      );
    }
    return part;
  });
  return <>{parts}</>;
}
