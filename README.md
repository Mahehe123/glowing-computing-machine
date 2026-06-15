# AirQuote — Compressor Quotation Generator & Sales Dashboard

A free, team-friendly web app: build branded PDF quotations from your air-compressor
catalog and track sales performance. **Vite + React + Tailwind** frontend (hosted on
GitHub Pages), **Supabase** (Postgres + Auth + Row Level Security) backend. Currency: MYR.

## Features
- **Quotation generator** — filter the catalog (series / air quality / type / search),
  add line items, apply per-line **discount or markup**, plus a quote-level discount and tax.
- **Customers** — shared team CRM, save & reuse.
- **Auto-loaded profile** — each salesperson logs in; their company/contact/terms auto-fill every quote.
- **PDF export** — branded A4 quotation.
- **Sales dashboard** — won revenue, open pipeline, win rate, avg deal size, conversion funnel,
  revenue by month, **discount leakage**, win rate by product series, and a follow-up action list.

---

## One-time setup

### 1. Supabase (data + auth)
1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run [`supabase/01_schema.sql`](supabase/01_schema.sql) (tables + RLS + auto-profile trigger).
3. Run [`supabase/02_products_seed.sql`](supabase/02_products_seed.sql) to load your catalog.
   - Regenerate anytime from the Excel: `python scripts/generate_products_sql.py`
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
   > These two values are *meant* to be public. Security comes from Row Level Security +
   > login, not from hiding them. Never put the `service_role` key in this app.
5. **Authentication → Providers → Email**: for a small team, turn **off** "Confirm email"
   so members can sign in immediately (optional).

### 2. Run locally (needs Node.js LTS)
```bash
cp .env.example .env      # then paste your URL + anon key
npm install
npm run dev
```
Open the printed URL, create an account, fill in **My Profile**, and make a quote.

### 3. Deploy free on GitHub Pages
1. Push this folder to a GitHub repo.
2. Repo **Settings → Secrets and variables → Actions** → add:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Repo **Settings → Pages** → Source: **GitHub Actions**.
4. Push to `main` — the workflow in `.github/workflows/deploy.yml` builds and publishes.

---

## Data model
| table | purpose |
|-------|---------|
| `profiles` | one per user, auto-filled into quotes |
| `products` | catalog; core specs as columns + `category` + `specs` JSONB (family-scoped) |
| `customers` | shared CRM |
| `quotations` | header: status, dates, discount, totals |
| `quotation_items` | lines with **snapshotted** unit price + per-line adjustment |

Prices are snapshotted onto line items, so historical quotes never change when the catalog reprices.
