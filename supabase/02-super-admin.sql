-- Ambica Attendance — super admins (run once, after schema.sql)
--
-- Only a SUPER admin can add or remove admins. Normal admins can do everything
-- else (drivers, attendance, salary) but cannot change who has access.
-- Nobody can create their own account: admins are invited by email.

alter table public.admins add column if not exists is_super boolean not null default false;

-- Make the owner a super admin (change the email if needed).
update public.admins set is_super = true where email = 'ambicae2@gmail.com';

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', '')) and active and is_super
  );
$$;
grant execute on function public.is_super_admin() to authenticated;

-- Replace the blanket policy on `admins`: everyone signed in as an admin can READ
-- the list; only super admins can change it.
drop policy if exists admin_all on public.admins;
drop policy if exists admins_read on public.admins;
drop policy if exists admins_write on public.admins;

create policy admins_read on public.admins for select to authenticated
  using (public.is_admin());
create policy admins_write on public.admins for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Check: your email should show is_super = true
select email, name, active, is_super from public.admins;
