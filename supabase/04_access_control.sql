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
drop policy if exists "profiles insert" on public.profiles;
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
