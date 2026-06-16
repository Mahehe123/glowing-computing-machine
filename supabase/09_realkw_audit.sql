-- ============================================================
-- Real/input power (for accurate comparison) + price-change audit stamp.
-- Safe to run once.
-- ============================================================
alter table public.products add column if not exists real_kw          numeric;     -- actual/input power (kW)
alter table public.products add column if not exists price_updated_at timestamptz; -- when selling price last changed
