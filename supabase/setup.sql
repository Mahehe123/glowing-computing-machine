-- ============================================================
-- AirQuote — ONE-SHOT idempotent setup. Safe to run on a fresh
-- OR existing database; brings it fully up to date.
-- After this, run 02_products_seed.sql ONCE for the initial catalog.
-- (Order: base tables -> access fns/policies -> column migrations -> data.)
-- ============================================================


-- ===== 01_schema.sql =====

-- ============================================================
-- AirQuote — schema + Row Level Security
-- Run this in the Supabase SQL editor (one time).
-- ============================================================

-- ---------- PROFILES (one per auth user, auto-loaded on login) ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'sales',   -- 'admin' | 'sales' (see 04_access_control.sql)
  active        boolean not null default true,    -- false = access revoked
  full_name     text,
  company_name  text,
  phone         text,
  email         text,
  address       text,
  logo_url      text,
  default_terms text,
  signature     text,
  updated_at    timestamptz default now()
);

-- Auto-create a blank profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- PRODUCTS (shared catalog) ----------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  model        text not null,
  brand        text,                         -- usually your company; supports multi-brand
  tpl          text,
  series       text,
  category     text,                        -- derived from series (e.g. "Oil lube compressor")
  type         text,
  air_quality  text,
  wc_ac        text,
  kw           numeric,
  hp           numeric,
  real_kw      numeric,                      -- actual/input power for comparison energy calcs
  cfm_min      numeric,
  cfm_max      numeric,
  price_rm     numeric default 0,           -- selling price (shown to customer)
  cost_rm      numeric default 0,           -- our cost (internal / dashboard only, never on PDF)
  cost_updated_at timestamptz,              -- when cost was last set (staleness flag)
  price_updated_at timestamptz,             -- when selling price last changed (audit)
  lead_time_weeks numeric,                  -- minimum lead time in weeks (quote shows min..min+2)
  specs        jsonb default '{}'::jsonb,   -- all the family-specific attributes
  created_at   timestamptz default now()
);
create index if not exists products_series_idx on public.products(series);
create index if not exists products_category_idx on public.products(category);

-- ---------- CUSTOMERS (shared CRM) ----------
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  company        text not null,
  contact_person text,
  email          text,
  phone          text,
  address        text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz default now()
);

-- ---------- QUOTATIONS ----------
create table if not exists public.quotations (
  id                 uuid primary key default gen_random_uuid(),
  quote_no           text unique not null,
  customer_id        uuid references public.customers(id) on delete set null,
  salesperson_id     uuid references auth.users(id),
  quote_date         date default current_date,
  valid_until        date,
  status             text default 'draft'
                     check (status in ('draft','sent','won','lost','expired')),
  quote_discount_pct numeric default 0,
  tax_pct            numeric default 0,
  subtotal           numeric default 0,
  total              numeric default 0,
  notes              text,
  terms              text,
  created_at         timestamptz default now()
);
create index if not exists quotations_status_idx on public.quotations(status);
create index if not exists quotations_sales_idx on public.quotations(salesperson_id);

-- ---------- QUOTATION ITEMS ----------
create table if not exists public.quotation_items (
  id           uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  model        text,
  description  text,
  unit_price   numeric default 0,   -- selling price snapshot at quote time
  unit_cost    numeric default 0,   -- cost snapshot at quote time (for margin analytics)
  markup_pct   numeric default 0,   -- smart-markup % (selling = cost / (1 - markup%))
  qty          numeric default 1,
  adjust_type  text default 'discount' check (adjust_type in ('discount','markup')),
  adjust_pct   numeric default 0,
  line_total   numeric default 0,
  position     int default 0
);
create index if not exists qitems_quote_idx on public.quotation_items(quotation_id);

-- ---------- COMPETITORS (for the Comparison / TCO tool) ----------
create table if not exists public.competitors (
  id               uuid primary key default gen_random_uuid(),
  brand            text not null,
  model            text not null,
  type             text,
  loading_pressure numeric,
  flow_m3min       numeric,
  flow_cfm         numeric,
  rated_kw         numeric,
  real_kw          numeric,
  noise_db         numeric,
  dimension        text,
  weight_kg        numeric,
  is_inverter      boolean default false,
  price_rm         numeric default 0,
  specs            jsonb default '{}'::jsonb,
  created_by       uuid references auth.users(id),
  created_at       timestamptz default now()
);

-- ---------- APP SETTINGS (single row, admin-editable) ----------
create table if not exists public.app_settings (
  id               int primary key default 1,
  cost_stale_months int not null default 6,
  updated_at       timestamptz default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- Protection model: the public anon key can reach the API, but every
-- table below requires an authenticated session. Nothing is readable
-- or writable without logging in.
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.customers       enable row level security;
alter table public.quotations      enable row level security;
alter table public.quotation_items enable row level security;

-- PROFILES: everyone signed in can read (so quotes show author);
-- you can only write your own.  (drop-if-exists keeps this re-runnable;
-- 04_access_control.sql later replaces these with the role-aware versions.)
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles upsert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles upsert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update to authenticated using (auth.uid() = id);

-- PRODUCTS: shared catalog, any signed-in team member can read & manage.
drop policy if exists "products all" on public.products;
create policy "products all" on public.products for all to authenticated using (true) with check (true);

-- CUSTOMERS: shared across the team.
drop policy if exists "customers all" on public.customers;
create policy "customers all" on public.customers for all to authenticated using (true) with check (true);

-- QUOTATIONS: whole team can read (for the dashboard); you modify your own.
drop policy if exists "quotes read"   on public.quotations;
drop policy if exists "quotes insert" on public.quotations;
drop policy if exists "quotes update" on public.quotations;
drop policy if exists "quotes delete" on public.quotations;
create policy "quotes read"   on public.quotations for select to authenticated using (true);
create policy "quotes insert" on public.quotations for insert to authenticated with check (auth.uid() = salesperson_id);
create policy "quotes update" on public.quotations for update to authenticated using (auth.uid() = salesperson_id);
create policy "quotes delete" on public.quotations for delete to authenticated using (auth.uid() = salesperson_id);

-- QUOTATION ITEMS: readable by team; writable only on quotes you own.
drop policy if exists "qitems read"  on public.quotation_items;
drop policy if exists "qitems write" on public.quotation_items;
create policy "qitems read" on public.quotation_items for select to authenticated using (true);
create policy "qitems write" on public.quotation_items for all to authenticated
  using (exists (select 1 from public.quotations q where q.id = quotation_id and q.salesperson_id = auth.uid()))
  with check (exists (select 1 from public.quotations q where q.id = quotation_id and q.salesperson_id = auth.uid()));

-- ===== 04_access_control.sql =====

-- ============================================================
-- Access control: admin role + active/revoked flag, enforced by RLS.
-- Invite-only model (disable public sign-up in Auth settings separately).
-- Safe to run once. Order matters: set the first admin BEFORE the guard trigger.
-- ============================================================

-- 1) Columns
alter table public.profiles add column if not exists role   text    not null default 'sales';   -- 'admin' | 'sales'
alter table public.profiles add column if not exists active  boolean not null default true;       -- false = revoked

-- 2) Seed the first admin (you) BEFORE the protection trigger exists.
update public.profiles set role = 'admin', active = true
where email = 'chriscarlos2004@gmail.com';

-- 3) Helper functions (SECURITY DEFINER bypasses RLS -> no recursion).
create or replace function public.is_active() returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- 4) Stop non-admins from changing their own role/active via the API.
--    (auth.uid() is null in the SQL editor = trusted service context = allowed.)
create or replace function public.protect_profile_privileges() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- 5) Rebuild RLS policies to require an ACTIVE account for all data.
-- profiles: read your own (always, so the app can see your status) or any if admin.
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles upsert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- products: active users only.
drop policy if exists "products all" on public.products;
create policy "products all" on public.products for all to authenticated using (public.is_active()) with check (public.is_active());

-- customers: active users only.
drop policy if exists "customers all" on public.customers;
create policy "customers all" on public.customers for all to authenticated using (public.is_active()) with check (public.is_active());

-- quotations: active users read all; modify your own (admins may modify any).
drop policy if exists "quotes read"   on public.quotations;
drop policy if exists "quotes insert" on public.quotations;
drop policy if exists "quotes update" on public.quotations;
drop policy if exists "quotes delete" on public.quotations;
create policy "quotes read"   on public.quotations for select to authenticated using (public.is_active());
create policy "quotes insert" on public.quotations for insert to authenticated with check (public.is_active() and auth.uid() = salesperson_id);
create policy "quotes update" on public.quotations for update to authenticated using (public.is_active() and (auth.uid() = salesperson_id or public.is_admin()));
create policy "quotes delete" on public.quotations for delete to authenticated using (public.is_active() and (auth.uid() = salesperson_id or public.is_admin()));

-- quotation_items: active users read; write on quotes you own (or admin).
drop policy if exists "qitems read"  on public.quotation_items;
drop policy if exists "qitems write" on public.quotation_items;
create policy "qitems read"  on public.quotation_items for select to authenticated using (public.is_active());
create policy "qitems write" on public.quotation_items for all to authenticated
  using (public.is_active() and exists (select 1 from public.quotations q where q.id = quotation_id and (q.salesperson_id = auth.uid() or public.is_admin())))
  with check (public.is_active() and exists (select 1 from public.quotations q where q.id = quotation_id and (q.salesperson_id = auth.uid() or public.is_admin())));

-- ===== 03_migrate.sql =====

-- Idempotent migration to bring an existing database up to the current schema.
-- Safe to run multiple times. (Fresh installs get these from 01_schema.sql.)
alter table public.products        add column if not exists cost_rm numeric default 0;
alter table public.products        add column if not exists category text;
alter table public.products        add column if not exists lead_time_weeks numeric;
alter table public.quotation_items add column if not exists unit_cost numeric default 0;

-- ===== 05_quote_extras.sql =====

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

-- ===== 06_competitors.sql =====

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

-- ===== 07_brand_cost_settings.sql =====

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

alter table public.app_settings enable row level security;
drop policy if exists "settings read"   on public.app_settings;
drop policy if exists "settings update" on public.app_settings;
create policy "settings read"   on public.app_settings for select to authenticated using (public.is_active());
create policy "settings update" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== 09_realkw_audit.sql =====

-- ============================================================
-- Real/input power (for accurate comparison) + price-change audit stamp.
-- Safe to run once.
-- ============================================================
alter table public.products add column if not exists real_kw          numeric;     -- actual/input power (kW)
alter table public.products add column if not exists price_updated_at timestamptz; -- when selling price last changed

-- ===== 08_rename_categories.sql =====

-- ============================================================
-- Rename product categories to the equipment-family taxonomy.
-- Safe to run once (idempotent — only touches old names).
-- ============================================================
update public.products set category = 'Air compressor'    where category in ('Oil free compressor', 'Oil lube compressor');
update public.products set category = 'Air receiver tank'  where category = 'Air Tank';
update public.products set category = 'Filter'             where category = 'Air filter';
-- 'Dryer' is unchanged.
