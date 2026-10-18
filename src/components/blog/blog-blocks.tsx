/* eslint-disable @next/next/no-img-element -- post images can be hosted anywhere */
import Link from "next/link";
import { Check, Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { Block } from "@/lib/blog";
import { cn } from "@/lib/utils";
import { RichText } from "./rich-text";

const ASPECT = { wide: "aspect-[16/9]", square: "aspect-square", portrait: "aspect-[4/5] max-w-md mx-auto" } as const;

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className={cn("text-lg leading-relaxed text-foreground/85", block.dropCap && "first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-serif first-letter:text-6xl first-letter:font-bold first-letter:leading-none first-letter:text-coral")}>
          <RichText text={block.text} />
        </p>
      );
    case "heading":
      if (block.level === 3) {
        return (
          <h3 className="flex items-baseline gap-4 pt-2 font-serif text-xl font-semibold sm:text-2xl">
            {block.eyebrow ? <span className="shrink-0 font-serif text-3xl font-bold text-coral sm:text-4xl">{block.eyebrow}</span> : null}
            <span>{block.text}</span>
          </h3>
        );
      }
      return (
        <div className="pt-6">
          {block.eyebrow ? <p className="text-sm font-semibold uppercase tracking-widest text-coral">{block.eyebrow}</p> : null}
          <h2 className="mt-1 font-serif text-3xl font-bold leading-tight sm:text-4xl">{block.text}</h2>
          <div className="mt-4 h-1 w-14 rounded-full bg-coral" aria-hidden />
        </div>
      );
    case "image":
      return (
        <figure>
          <div className={cn("overflow-hidden rounded-2xl bg-accent-soft shadow-sm", ASPECT[block.aspect ?? "wide"])}>
            <img src={block.src} alt={block.alt} loading="lazy" className="h-full w-full object-cover" />
          </div>
          {block.caption ? <figcaption className="mt-3 text-center text-sm italic text-muted">{block.caption}</figcaption> : null}
        </figure>
      );
    case "imageText":
      return (
        <div className="grid items-center gap-6 sm:grid-cols-2">
          <img src={block.src} alt={block.alt} loading="lazy" className={cn("aspect-[4/3] w-full rounded-2xl object-cover shadow-sm", block.layout === "imageRight" && "sm:order-2")} />
          <div>
            {block.heading ? <h3 className="font-serif text-2xl font-semibold">{block.heading}</h3> : null}
            <p className="mt-2 text-lg leading-relaxed text-foreground/85"><RichText text={block.text} /></p>
          </div>
        </div>
      );
    case "steps":
      return (
        <ol className="space-y-5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy font-serif font-bold text-white">{i + 1}</span>
              <div>
                <h3 className="font-serif text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 leading-relaxed text-foreground/80"><RichText text={item.text} /></p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "checklist":
      return (
        <div className="rounded-2xl bg-accent-soft p-6 sm:p-8">
          {block.title ? <h3 className="mb-4 font-serif text-xl font-semibold">{block.title}</h3> : null}
          <ul className="space-y-3">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coral text-white"><Check className="h-4 w-4" aria-hidden /></span>
                <span className="leading-relaxed text-foreground/85"><RichText text={item} /></span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "table":
      return (
        <figure>
          <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-navy text-white">
                <tr>{block.headers.map((h, i) => <th key={i} scope="col" className="px-5 py-3 text-sm font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-border even:bg-cream">
                    {row.map((cell, ci) => <td key={ci} className={cn("px-5 py-3", ci === 0 ? "font-semibold text-foreground" : "text-foreground/75")}><RichText text={cell} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption ? <figcaption className="mt-3 text-center text-sm italic text-muted">{block.caption}</figcaption> : null}
        </figure>
      );
    case "callout": {
      const variant = block.variant ?? "tip";
      const Icon = variant === "warning" ? TriangleAlert : variant === "info" ? Info : Lightbulb;
      return (
        <aside className={cn("rounded-2xl border-l-4 p-6 sm:p-8", variant === "tip" && "bg-dark-gradient border-coral text-white", variant === "info" && "border-accent bg-accent-soft", variant === "warning" && "border-gold bg-amber-50")}>
          <p className={cn("flex items-center gap-2 text-sm font-semibold uppercase tracking-widest", variant === "tip" ? "text-coral" : variant === "info" ? "text-accent" : "text-amber-700")}>
            <Icon className="h-4 w-4" aria-hidden />
            {block.title ?? (variant === "warning" ? "Heads up" : variant === "info" ? "Good to know" : "Tip")}
          </p>
          <p className={cn("mt-3 text-lg leading-relaxed", variant === "tip" ? "text-white/90" : "text-foreground/85")}><RichText text={block.text} /></p>
        </aside>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-4 border-coral py-2 pl-6 sm:pl-8">
          <p className="font-serif text-2xl font-medium italic leading-snug text-navy sm:text-3xl">&ldquo;<RichText text={block.text} />&rdquo;</p>
          {block.cite ? <footer className="mt-4 text-sm font-semibold text-muted">— {block.cite}</footer> : null}
        </blockquote>
      );
    case "faq":
      return (
        <div className="divide-y divide-border rounded-2xl border border-border bg-white shadow-sm">
          {block.items.map((item, i) => (
            <details key={i} className="group px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                {item.q}
                <span className="text-xl text-coral transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-foreground/80"><RichText text={item.a} /></p>
            </details>
          ))}
        </div>
      );
    case "cta":
      return (
        <div className="bg-dark-gradient rounded-2xl p-8 text-center text-white sm:p-10">
          <h2 className="font-serif text-2xl font-bold sm:text-3xl">{block.heading}</h2>
          {block.text ? <p className="mx-auto mt-3 max-w-xl text-white/85"><RichText text={block.text} /></p> : null}
          <Link href={block.buttonHref} className="btn-coral mt-6 inline-flex rounded-lg px-8 py-3 text-base">{block.buttonLabel}</Link>
        </div>
      );
  }
}

export function BlogBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-7">
      {blocks.map((block, i) => <BlockView key={i} block={block} />)}
    </div>
  );
}
