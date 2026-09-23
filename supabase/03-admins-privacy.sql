-- Ambica Attendance — a normal admin can only see their own admin row.
-- Super admins see (and manage) the full list.

drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select to authenticated
  using (
    public.is_super_admin()
    or email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- (admins_write from 02-super-admin.sql stays: only super admins can add/remove.)
