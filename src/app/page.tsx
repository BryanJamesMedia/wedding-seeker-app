/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  Bookmark, Building2, Check, Heart, LayoutDashboard, ListFilter, MapPin, MessageSquareText, Search, Send, Sparkles, Store,
} from "lucide-react";
import { HeroVideo } from "@/components/landing/hero-video";
import { Testimonials } from "@/components/landing/testimonials";
import { PostOverlayCard } from "@/components/blog/post-card";
import { listPosts } from "@/lib/blog";
import { countListingsByType } from "@/lib/search";

export const revalidate = 300;

function SearchCta({ children = "Start Your Search", className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <Link href="/search" className={`btn-coral inline-flex items-center justify-center rounded-lg px-10 py-4 text-lg ${className}`}>
      {children}
    </Link>
  );
}

const CATEGORY_TILES = [
  ["Venues", "vendor-venue"], ["Photo / Video", "vendor-photo-video"], ["Catering & Food", "vendor-catering"], ["Bar & Beverages", "vendor-bar"],
  ["Cakes & Desserts", "vendor-catering"], ["DJ / Entertainment", "vendor-photo-video"], ["Live Band / Musicians", "vendor-venue"],
  ["Florists & Floral Design", "vendor-florist"], ["Wedding Planners", "vendor-catering"], ["Officiants", "vendor-venue"],
  ["Hair & Makeup", "vendor-photo-video"], ["Day-of Coordinators", "vendor-bar"], ["Rentals", "vendor-catering"],
  ["Decor / Lighting", "vendor-florist"], ["Photo Booths", "vendor-photo-video"], ["Transportation", "vendor-venue"],
  ["Invitations", "vendor-florist"], ["Accommodations", "vendor-bar"], ["Restaurant Group Bookings", "vendor-catering"], ["Bridal Attire", "vendor-photo-video"],
] as const;

const TRUST_POINTS = [
  "Every venue and vendor in one place — no more jumping between a dozen listing sites.",
  "Describe the wedding you want in plain English. Our search understands vibe, not just keywords.",
  "Filter by location, distance, guest count, budget and style, then see the best fits first.",
  "Send your wedding details to the vendors you like in one click, and track every reply.",
];

const STEPS = [
  { n: "01", title: "Describe Your Wedding", icon: MessageSquareText, text: "Pick what you're looking for and where, then tell us the wedding you have in mind — “sunset beach ceremony, about 60 guests, relaxed and elegant.”" },
  { n: "02", title: "See Your Best Matches", icon: ListFilter, text: "We search every venue and vendor in your area and rank them by how well they fit your filters and your description. Closest matches first." },
  { n: "03", title: "Connect in One Click", icon: Send, text: "Save your favorites and send your wedding details to the ones you love. Vendors reply to you directly, and every response lands in your dashboard." },
];

const FEATURES = [
  { icon: Search, title: "Plain-English Search", text: "Search the way you talk. Describe the feel of your day and get results that match it." },
  { icon: Sparkles, title: "Every Option, Ranked", text: "Every listing that fits your filters is included, with the strongest matches at the top." },
  { icon: MapPin, title: "Search by Distance", text: "Search by city or ZIP code and choose how far you're willing to travel." },
  { icon: Bookmark, title: "Saved Favorites & Searches", text: "Keep a shortlist of venues and vendors and re-run your favorite searches anytime." },
  { icon: Send, title: "One-Click Connect", text: "Send your date, guest count and budget to vendors in one step — no retyping the same email." },
  { icon: LayoutDashboard, title: "Your Planning Dashboard", text: "See who you've contacted, who's interested and who replied, all in one place." },
];

const FAQS = [
  ["Is it free to search?", "Yes. Anyone can search every venue and vendor without signing up. Create a free account to save favorites and searches, and upgrade to Wedding Seeker Plus to see full contact details and connect with vendors in one click."],
  ["How does the search know what I want?", "Pick a category and a location, then describe your wedding in your own words. We combine your filters, distance and description to rank every listing by how well it fits — so “rustic barn, 150 guests” and “intimate beach elopement” get very different results."],
  ["Do I have to book through Wedding Seeker?", "No. When you connect with a vendor, they reply to you directly. You talk, negotiate and book with them yourself — we just make finding and reaching the right ones fast."],
  ["What areas do you cover?", "Thousands of venues and vendors, with the deepest coverage in Florida. Search by city or ZIP code and pick a radius to see everything nearby."],
  ["How do I know if a vendor is available on my date?", "Send them a Connect request with your date and details. They'll tell you whether they're available and interested, and you'll see their answer in your dashboard."],
  ["Is my information safe?", "Your details are only shared with the vendors you choose to connect with. We never sell your information."],
  ["What types of weddings can I search for?", "All of them — elopements for two, micro weddings, backyard ceremonies, destination weekends and grand celebrations with 300+ guests. Just describe what you're planning."],
  ["What if I don't have all my details figured out yet?", "That's completely normal. Start with a location and the type of vendor you need. You can always refine your description and filters as your plans come together."],
  ["Can I save my searches?", "Yes. With a free account you can save searches and favorite listings, then come back to them anytime from your dashboard."],
  ["Do you work with LGBTQ+ couples?", "Absolutely. Love is love, and every couple deserves vendors who celebrate them."],
];

export default async function Home() {
  const [counts, posts] = await Promise.all([countListingsByType(), listPosts({ limit: 3 })]);
  const [featured, ...secondary] = posts;

  return (
    <>
      {/* Hero */}
      <section className="bg-hero relative border-b-2 border-accent">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-16 md:pb-32 md:pt-24 lg:grid-cols-[1fr_auto] lg:gap-16">
          <div className="max-w-2xl">
            <h1 className="font-serif text-4xl font-bold leading-tight text-white text-balance md:text-5xl">
              The Smartest Way to Find Your Perfect Wedding Venue &amp; Vendors
            </h1>
            <p className="mt-6 max-w-xl text-xl font-light text-white/85 md:text-2xl">
              Search every venue and vendor near you, describe your dream wedding in your own words, and see the best fits first.
            </p>
            <div className="mt-8 flex flex-col items-start">
              <SearchCta className="px-10 py-5">Start Your Search</SearchCta>
              <p className="mt-4 font-serif text-lg italic text-white">Free to search. No forms, no waiting.</p>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroVideo />
          </div>
        </div>
      </section>

      {/* The stakes */}
      <section className="bg-cream px-4 py-20 text-center">
        <h2 className="font-serif text-3xl font-bold md:text-4xl">Wedding Planning Shouldn&apos;t Feel Like a Second Job.</h2>
        <div className="mx-auto mt-6 max-w-3xl space-y-4 text-lg leading-relaxed text-muted">
          <p>You email a venue. They&apos;re booked. You email another — too small. Another — out of budget.</p>
          <p>Your evenings disappear into endless listing sites, each with a different handful of options and no way to compare them.</p>
          <p className="font-semibold text-foreground">You&apos;re supposed to be excited about getting married. Instead, you&apos;re exhausted.</p>
          <p>There&apos;s a better way to search — <strong className="text-foreground">one place, every option, ranked for the wedding you actually want</strong>.</p>
        </div>
        <div className="mx-auto mt-6 h-0.5 w-16 bg-accent" aria-hidden />
      </section>

      {/* Introducing */}
      <section className="relative overflow-hidden bg-white py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/landing/floral-roses-background.jpg')] bg-cover bg-center opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4">
          <h2 className="mx-auto mb-16 max-w-4xl text-center font-serif text-3xl font-bold leading-tight text-balance">
            Find Your Venue and Vendors in Minutes, Not Weekends
          </h2>
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-16">
            <div className="relative">
              <img src="/landing/wedding-concierge-about.jpg" alt="Bride and groom on their wedding day" className="aspect-square w-full rounded-sm object-cover shadow-md" />
              <div className="absolute -bottom-8 -right-4 h-32 w-32 md:-right-8 md:h-40 md:w-40" aria-hidden>
                <svg viewBox="0 0 200 200" className="h-full w-full animate-[spin_20s_linear_infinite] motion-reduce:animate-none">
                  <defs><path id="badge-circle" d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0" /></defs>
                  <text className="fill-accent text-[14px] font-semibold tracking-[0.3em]"><textPath href="#badge-circle">SEARCH • MATCH • CONNECT • SEARCH • MATCH •</textPath></text>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent md:h-20 md:w-20">
                    <Heart className="h-7 w-7 fill-white text-white" />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="font-serif text-xl font-bold">Introducing Wedding Seeker</h3>
              <p className="text-sm font-bold text-accent">The search engine built for wedding planning</p>
              <div className="space-y-4 leading-relaxed text-muted">
                <p>Tell us what you need and where — a venue, a photographer, a florist — then describe your wedding in your own words: your style, your guest count, the feeling you want.</p>
                <p>We search every listing in your area and rank them by how well they match. No sponsored placements pushed to the top, no endless scrolling through options that were never a fit.</p>
                <p>When you find ones you love, save them or send your wedding details in one click, and follow every reply from your dashboard.</p>
              </div>
              <div className="space-y-1 pt-2 text-lg font-semibold">
                <p>You describe your dream wedding.</p>
                <p>We show you who can make it happen.</p>
              </div>
              <div className="pt-4"><SearchCta className="px-10 py-4 text-base" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Database banner */}
      <section aria-label="Venue and vendor database">
        <div className="bg-navy px-4 py-10 text-center sm:py-12">
          <h2 className="font-serif text-xl font-bold text-white sm:text-2xl md:text-3xl">The Largest Vendor and Venue Database in Florida</h2>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-lg font-semibold text-white sm:text-xl">
            <span className="flex items-center gap-2.5"><Store className="h-5 w-5 text-coral" aria-hidden /><span className="font-bold text-coral">{counts.vendors.toLocaleString()}</span> Vendors</span>
            <span className="flex items-center gap-2.5"><Building2 className="h-5 w-5 text-coral" aria-hidden /><span className="font-bold text-coral">{counts.venues.toLocaleString()}</span> Venues</span>
          </div>
        </div>
        <div className="bg-background py-16">
          <p className="mx-auto mb-8 max-w-2xl px-4 text-center text-lg text-muted">
            Whether you&apos;re planning an intimate elopement or a 300-guest celebration, search:
          </p>
          <div className="mb-8 overflow-hidden">
            <ul className="ws-marquee flex w-max gap-6">
              {[...CATEGORY_TILES, ...CATEGORY_TILES].map(([name, image], i) => (
                <li key={i} className="w-40 shrink-0 text-center" aria-hidden={i >= CATEGORY_TILES.length}>
                  <img src={`/landing/${image}.jpg`} alt="" loading="lazy" className="mb-3 h-40 w-40 rounded-lg object-cover" />
                  <span className="text-sm font-semibold leading-tight">{name}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-center text-lg font-medium">You choose what you need. We handle the search.</p>
        </div>
      </section>

      {/* Why couples trust */}
      <section className="bg-dark-gradient py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2">
          <div className="space-y-6 text-white">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wider text-coral">The Wedding Seeker Difference</p>
              <h2 className="font-serif text-4xl font-bold md:text-5xl">Why Couples Trust Wedding Seeker</h2>
            </div>
            <ul className="space-y-3 text-white/90">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coral/20"><Check className="h-4 w-4 text-coral" aria-hidden /></span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <p className="text-lg leading-relaxed text-white/90">No guessing. No wasted time. No vendors who were never the right fit to begin with.</p>
            <p className="text-lg font-semibold text-coral">That&apos;s the Wedding Seeker difference.</p>
            <SearchCta className="px-8 py-4 text-base" />
          </div>
          <div className="relative h-[500px] overflow-hidden rounded-lg">
            <img src="/landing/support-ceremony-moment.jpg" alt="Wedding ceremony moment" loading="lazy" className="h-full w-full object-cover" />
            <span className="pointer-events-none absolute bottom-8 right-8 font-serif text-[180px] font-bold leading-none text-white/10" aria-hidden>01</span>
          </div>
        </div>
      </section>

      <Testimonials />

      {/* How it works */}
      <section className="bg-dark-gradient py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <h2 className="font-serif text-3xl font-bold text-white md:text-4xl">How It Works</h2>
            <div className="mx-auto mt-4 h-0.5 w-16 bg-coral" aria-hidden />
          </div>
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="h-full rounded-lg border border-border bg-white p-8 shadow-sm">
                <div className="mb-4 flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10"><step.icon className="h-6 w-6 text-accent" aria-hidden /></span>
                  <span className="text-4xl font-bold text-accent/20" aria-hidden>{step.n}</span>
                </div>
                <h3 className="mb-3 font-serif text-xl font-bold">{step.title}</h3>
                <p className="leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-16 text-center"><SearchCta className="px-16 py-5" /></div>
        </div>
      </section>

      {/* What you get */}
      <section className="bg-cream py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">Everything In One Place</p>
            <h2 className="font-serif text-3xl font-bold md:text-4xl">What You Get</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10"><f.icon className="h-6 w-6 text-accent" aria-hidden /></span>
                <h3 className="font-serif text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Without the burnout */}
      <section className="relative overflow-hidden border-b-2 border-[#f3a8ad] bg-[#f5f1ec]">
        <img src="/landing/cta-floral-left.webp" alt="" aria-hidden className="pointer-events-none absolute left-0 top-0 h-full w-1/3 max-w-sm select-none object-cover object-left [mask-image:linear-gradient(to_right,black_55%,transparent)]" />
        <img src="/landing/cta-floral-right.webp" alt="" aria-hidden className="pointer-events-none absolute right-0 top-0 h-full w-1/3 max-w-sm select-none object-cover object-right [mask-image:linear-gradient(to_left,black_55%,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#f5f1ec]/80" />
        <div className="relative mx-auto max-w-2xl px-4 py-16 text-center md:py-20">
          <h2 className="font-serif text-4xl font-bold leading-tight text-navy text-balance md:text-5xl">Wedding Planning, Without the Burnout</h2>
          <div className="my-6 flex justify-center"><Heart className="h-4 w-4 fill-[#f3a8ad] text-[#f3a8ad]" aria-hidden /></div>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted">
            Stop spending hours searching. Tell us what you want once and see every venue and vendor that fits — best matches first.
          </p>
          <div className="mt-8"><SearchCta className="px-10 py-4 text-base">Start Your Free Search</SearchCta></div>
          <p className="mt-6 text-sm text-muted">No sign-up needed to search.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center font-serif text-3xl font-bold md:text-4xl">Frequently Asked Questions</h2>
          <div className="grid gap-x-12 lg:grid-cols-2">
            {[FAQS.slice(0, 5), FAQS.slice(5)].map((column, c) => (
              <div key={c}>
                {column.map(([q, a]) => (
                  <details key={q} className="group border-b border-border py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium hover:text-accent">
                      {q}
                      <span className="text-xl text-accent transition-transform group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <p className="mt-3 text-muted">{a}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-12 text-center"><SearchCta className="px-10 py-4 text-base" /></div>
        </div>
      </section>

      {/* From the blog */}
      {featured ? (
        <section className="-mb-16 bg-[#f7e6dc]/80 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-12 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Wedding Planning Tips</p>
              <h2 className="mb-4 font-serif text-4xl font-bold md:text-5xl">From The Blog</h2>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted">
                Expert advice, planning guides, and inspiration to help you navigate every step of your wedding journey.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <PostOverlayCard post={featured} large />
              {secondary.map((post) => <PostOverlayCard key={post.slug} post={post} />)}
            </div>
            <div className="mt-12 text-center">
              <Link href="/blog" className="inline-flex rounded-lg bg-gradient-to-br from-[#7dbcf7] to-[#6d98e6] px-10 py-4 font-semibold text-white shadow-sm hover:brightness-105">
                View All Posts
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
