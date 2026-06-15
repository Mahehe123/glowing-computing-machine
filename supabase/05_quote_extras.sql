-- ============================================================
-- Win/loss capture, custom (non-catalog) line items, and T&C templates.
-- Safe to run once. Requires 04_access_control.sql (uses public.is_active()).
-- ============================================================

-- Win/Loss reason + competitor on each quote.
alter table public.quotations add column if not exists outcome_reason       text;  -- Pricing|Branding|Relationship|Aftermarket|Other
alter table public.quotations add column if not exists outcome_reason_note  text;  -- free text when 'Other'
alter table public.quotations add column if not exists competitor           text;  -- Atlas Copco|IR|Kobelco|Others
alter table public.quotations add column if not exists competitor_note      text;  -- free text when 'Others'

-- Custom line items (M&E / civil works / services): not from the catalog.
-- title -> shown on the page-1 summary line; description -> its own back page.
alter table public.quotation_items add column if not exists is_custom boolean not null default false;
alter table public.quotation_items add column if not exists title     text;

-- Shared library of Terms & Conditions templates.
create table if not exists public.quote_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  body       text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.quote_templates enable row level security;
drop policy if exists "templates all" on public.quote_templates;
create policy "templates all" on public.quote_templates for all to authenticated
  using (public.is_active()) with check (public.is_active());
