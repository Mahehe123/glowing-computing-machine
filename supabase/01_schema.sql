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
  tpl          text,
  series       text,
  category     text,                        -- derived from series (e.g. "Oil lube compressor")
  type         text,
  air_quality  text,
  wc_ac        text,
  kw           numeric,
  hp           numeric,
  cfm_min      numeric,
  cfm_max      numeric,
  price_rm     numeric default 0,           -- selling price (shown to customer)
  cost_rm      numeric default 0,           -- our cost (internal / dashboard only, never on PDF)
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
  is_inverter      boolean default false,
  price_rm         numeric default 0,
  specs            jsonb default '{}'::jsonb,
  created_by       uuid references auth.users(id),
  created_at       timestamptz default now()
);

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
-- you can only write your own.
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles upsert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update to authenticated using (auth.uid() = id);

-- PRODUCTS: shared catalog, any signed-in team member can read & manage.
create policy "products all" on public.products for all to authenticated using (true) with check (true);

-- CUSTOMERS: shared across the team.
create policy "customers all" on public.customers for all to authenticated using (true) with check (true);

-- QUOTATIONS: whole team can read (for the dashboard); you modify your own.
create policy "quotes read"   on public.quotations for select to authenticated using (true);
create policy "quotes insert" on public.quotations for insert to authenticated with check (auth.uid() = salesperson_id);
create policy "quotes update" on public.quotations for update to authenticated using (auth.uid() = salesperson_id);
create policy "quotes delete" on public.quotations for delete to authenticated using (auth.uid() = salesperson_id);

-- QUOTATION ITEMS: readable by team; writable only on quotes you own.
create policy "qitems read" on public.quotation_items for select to authenticated using (true);
create policy "qitems write" on public.quotation_items for all to authenticated
  using (exists (select 1 from public.quotations q where q.id = quotation_id and q.salesperson_id = auth.uid()))
  with check (exists (select 1 from public.quotations q where q.id = quotation_id and q.salesperson_id = auth.uid()));
