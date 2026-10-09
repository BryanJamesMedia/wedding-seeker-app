# Wedding Seeker — Couples App

Search-first venue and vendor directory for couples: natural-language + filtered search, gated listing details, Plus upgrade (Stripe), saves, Connect requests to vendors, and a dashboard.

Stack: Next.js 16 (App Router) on Vercel · Neon Postgres with pgvector + PostGIS · Better Auth (magic link, Google) · Stripe · Resend · OpenAI embeddings.

## Database setup (Neon)

Open the Neon SQL Editor and paste `db/neon-setup.sql` (safe to re-run). It enables `vector` and `postgis` and creates every table.
Regenerate it after adding a migration: `npm run db:bundle`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill DATABASE_URL etc.
npm run db:migrate
npm run db:seed              # ~400 fake listings
npm run db:embed             # uses OPENAI_API_KEY, or a deterministic local fallback
npm run dev
```

Without `RESEND_API_KEY`, emails are skipped and magic links are printed to the server log.

## Checks

```bash
npm run lint && npm run typecheck && npm run build
```

## Key routes

- `/` search · `/search` results · `/venues|vendors/[category]/[city]/[slug]` detail pages
- `/dashboard` (Saved, Searches, Connections, My Wedding, Settings) · `/admin` (admins only)
- Webhooks: `/api/stripe/webhook`, `/api/webhooks/resend`, `/api/webhooks/inbound`
- Cron: `/api/cron/embed` every 15 min (embeds new or edited listings)

Runtime settings (field visibility tiers, filters, ranking weights, match labels, limits) live in `app_config` and are editable at `/admin`.
