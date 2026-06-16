-- ============================================================
-- Competitor catalog for the Comparison (TCO) tool.
-- Safe to run once. Requires 04_access_control.sql (public.is_active()).
-- ============================================================
create table if not exists public.competitors (
  id               uuid primary key default gen_random_uuid(),
  brand            text not null,
  model            text not null,
  type             text,
  loading_pressure numeric,         -- bar g
  flow_m3min       numeric,         -- capacity m3/min (for SER / energy)
  flow_cfm         numeric,
  rated_kw         numeric,         -- nameplate motor power
  real_kw          numeric,         -- actual/input power (preferred for energy)
  noise_db         numeric,
  dimension        text,            -- "L x W x H" mm
  weight_kg        numeric,
  is_inverter      boolean default false,
  price_rm         numeric default 0,  -- competitor CAPEX, if known
  specs            jsonb default '{}'::jsonb,
  created_by       uuid references auth.users(id),
  created_at       timestamptz default now()
);
create index if not exists competitors_brand_idx on public.competitors(brand);
-- (idempotent in case the table predates these columns)
alter table public.competitors add column if not exists dimension text;
alter table public.competitors add column if not exists weight_kg numeric;

alter table public.competitors enable row level security;
drop policy if exists "competitors all" on public.competitors;
create policy "competitors all" on public.competitors for all to authenticated
  using (public.is_active()) with check (public.is_active());
