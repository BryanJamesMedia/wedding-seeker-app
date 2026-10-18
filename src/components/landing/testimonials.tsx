"use client";

/* eslint-disable @next/next/no-img-element */
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TESTIMONIALS = [
  { quote: "We were drowning in vendor research. Wedding Seeker gave us four venue options in three days—all available, all in budget. We booked our dream venue that same week.", author: "Sarah & Mike", role: "Married June 2025", image: "/landing/testimonial-wedding-1.jpg" },
  { quote: "I was spending every evening scrolling through listing sites. Wedding Seeker matched us with a photographer and caterer in 48 hours. Both were exactly what we wanted.", author: "Emily & James", role: "Married August 2025", image: "/landing/testimonial-wedding-2.jpg" },
  { quote: "The best part? Every vendor who contacted us already knew our budget and date. No awkward conversations. No wasted time. Just real options we could actually book.", author: "Jessica & David", role: "Getting Married Fall 2025", image: "/landing/testimonial-wedding-3.jpg" },
  { quote: "Every vendor we got matched with was already pre-vetted for our style and budget. It felt like having a wedding planner on speed dial — but free.", author: "Ava & Noah", role: "Married September 2025", image: "/landing/testimonial-wedding-1.jpg" },
  { quote: "I sent one inquiry and got curated matches the next morning. We booked our florist within a week and saved hours of back-and-forth emails.", author: "Olivia & Liam", role: "Getting Married Spring 2026", image: "/landing/testimonial-wedding-2.jpg" },
  { quote: "Honest reviews. Real availability. Real budgets. Wedding Seeker is the only place I trusted during planning — and we recommend it to every engaged friend.", author: "Mia & Ethan", role: "Married July 2025", image: "/landing/testimonial-wedding-3.jpg" },
];
const PAGE_SIZE = 3;
const PAGES = Math.ceil(TESTIMONIALS.length / PAGE_SIZE);

function Stars() {
  return (
    <span className="flex gap-0.5" role="img" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />)}
    </span>
  );
}

export function Testimonials() {
  const [page, setPage] = useState(0);
  const visible = TESTIMONIALS.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  return (
    <section aria-labelledby="testimonials-heading" className="relative overflow-hidden bg-white py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/landing/testimonial-background.jpg')] bg-cover bg-center opacity-50" />
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h2 id="testimonials-heading" className="font-serif text-3xl font-bold sm:text-4xl">What Couples Are Saying</h2>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
            <Stars /> <span className="font-semibold text-foreground">5.0</span> <span>· verified couples</span>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <article key={t.author} className="flex flex-col rounded-xl border border-border bg-white p-6 shadow-sm">
              <header className="mb-3 flex items-center gap-3">
                <img src={t.image} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-border" />
                <div>
                  <p className="text-sm font-semibold">{t.author}</p>
                  <p className="text-xs text-muted">{t.role}</p>
                </div>
              </header>
              <div className="mb-2 flex items-center gap-2"><Stars /><span className="text-xs text-muted">Verified</span></div>
              <blockquote className="text-sm leading-relaxed text-muted">&ldquo;{t.quote}&rdquo;</blockquote>
            </article>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button type="button" onClick={() => setPage((p) => (p - 1 + PAGES) % PAGES)} aria-label="Previous reviews" className="rounded-full p-2 hover:bg-accent-soft">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex gap-2">
            {Array.from({ length: PAGES }, (_, i) => (
              <button key={i} type="button" onClick={() => setPage(i)} aria-label={`Reviews page ${i + 1}`} aria-current={i === page}
                className={cn("h-2.5 w-2.5 rounded-full", i === page ? "bg-accent" : "bg-border")} />
            ))}
          </div>
          <button type="button" onClick={() => setPage((p) => (p + 1) % PAGES)} aria-label="Next reviews" className="rounded-full p-2 hover:bg-accent-soft">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
