-- Idempotent migration to bring an existing database up to the current schema.
-- Safe to run multiple times. (Fresh installs get these from 01_schema.sql.)
alter table public.products        add column if not exists cost_rm numeric default 0;
alter table public.products        add column if not exists category text;
alter table public.products        add column if not exists lead_time_weeks numeric;
alter table public.quotation_items add column if not exists unit_cost numeric default 0;
