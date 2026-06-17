-- ============================================================
-- Brand, cost freshness, smart-markup, and app settings.
-- Safe to run once. Requires 04_access_control.sql (is_active / is_admin).
-- ============================================================

-- Products: brand + cost date stamp.
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists cost_updated_at timestamptz;

-- Quotation lines: smart-markup percentage (margin on selling = markup%).
alter table public.quotation_items add column if not exists markup_pct numeric default 0;

-- Single-row app settings (admin-editable).
create table if not exists public.app_settings (
  id               int primary key default 1,
  cost_stale_months int not null default 6,
  updated_at       timestamptz default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
-- Minimum acceptable margin %; quotes/catalog flag anything below this in red.
alter table public.app_settings add column if not exists min_margin_pct numeric not null default 15;

alter table public.app_settings enable row level security;
drop policy if exists "settings read"   on public.app_settings;
drop policy if exists "settings update" on public.app_settings;
create policy "settings read"   on public.app_settings for select to authenticated using (public.is_active());
create policy "settings update" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
