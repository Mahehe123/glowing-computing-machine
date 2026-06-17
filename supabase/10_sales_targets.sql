-- ============================================================
-- Per-user ANNUAL sales target (RM), admin-set, used by the dashboard
-- progress-to-target bar. Safe to run once.
-- Requires 04_access_control.sql (is_admin + protect trigger).
-- ============================================================

alter table public.profiles add column if not exists sales_target numeric;

-- Guard sales_target from self-service edits — only admins may change it,
-- mirroring the existing role/active guard.
create or replace function public.protect_profile_privileges() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
    new.sales_target := old.sales_target;
  end if;
  return new;
end $$;
