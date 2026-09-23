-- Ambica Attendance — security hardening. Run this AFTER schema.sql and 02/03/04.
-- Safe to re-run. If you ever re-run schema.sql, run this file again afterwards.

-- ─────────────────────────────────────────────────────────────
-- 1. Admin checks also require a confirmed email address
--    (stops someone claiming an invited-but-unused admin email)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.admins a
    join auth.users u on lower(u.email) = a.email
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and a.active
      and u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.admins a
    join auth.users u on lower(u.email) = a.email
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and a.active and a.is_super
      and u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Only super admins may change the admin list
--    (schema.sql's blanket policy must never cover this table)
-- ─────────────────────────────────────────────────────────────
drop policy if exists admin_all on public.admins;
drop policy if exists admins_read on public.admins;
drop policy if exists admins_write on public.admins;

create policy admins_read on public.admins for select to authenticated
  using (public.is_super_admin() or email = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy admins_write on public.admins for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. The driver portal returns only what a driver needs to see.
--    No bank details, no login code, no share token, no notes.
-- ─────────────────────────────────────────────────────────────
create or replace function public.driver_portal(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d public.drivers;
  key text := trim(p_code);
begin
  select * into d from public.drivers
  where login_code = upper(key) or share_token = lower(key)
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'driver', jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'photo_url', d.photo_url,
      'truck_number', d.truck_number,
      'phone', d.phone,
      'joining_date', d.joining_date,
      'left_on', d.left_on,
      'active', d.active,
      'login_code', '',
      'share_token', '',
      'email', null,
      'address', null,
      'bank_account', null,
      'bank_ifsc', null,
      'upi_id', null,
      'overtime_hour_rate', d.overtime_hour_rate
    ),
    'salary_history', coalesce((select jsonb_agg(to_jsonb(s)) from public.salary_history s where s.driver_id = d.id), '[]'),
    'attendance',     coalesce((select jsonb_agg(to_jsonb(a)) from public.attendance a where a.driver_id = d.id), '[]'),
    'holidays',       coalesce((select jsonb_agg(to_jsonb(h)) from public.holidays h), '[]'),
    'adjustments',    coalesce((select jsonb_agg(to_jsonb(x)) from public.adjustments x where x.driver_id = d.id), '[]'),
    'payments',       coalesce((select jsonb_agg(to_jsonb(p)) from public.payments p where p.driver_id = d.id), '[]'),
    'payroll_months', coalesce((select jsonb_agg(to_jsonb(m)) from public.payroll_months m where m.driver_id = d.id), '[]'),
    'company',        (select to_jsonb(c) from public.company_settings c where c.id = 1)
  );
end $$;

revoke all on function public.driver_portal(text) from public;
grant execute on function public.driver_portal(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Longer Driver IDs (old 6-character IDs were guessable)
--    Existing drivers get a new ID; send them their link again.
-- ─────────────────────────────────────────────────────────────
create or replace function public.new_driver_code() returns text
language sql volatile as $$
  select 'AMB-' || string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 10);
$$;

update public.drivers set login_code = public.new_driver_code()
where length(login_code) < 14;

-- Make sure every driver has a 32-character share token
update public.drivers set share_token = encode(gen_random_bytes(16), 'hex')
where share_token is null or length(share_token) <> 32;

-- ─────────────────────────────────────────────────────────────
-- 5. The activity log must not store or leak secrets
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  o jsonb;
  key text := case when tg_table_name = 'drivers' then 'id' else 'driver_id' end;
  secret text[] := array['share_token', 'login_code', 'bank_account', 'bank_ifsc', 'upi_id', 'notes', 'snapshot'];
  s text;
begin
  if tg_op <> 'DELETE' then r := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op = 'UPDATE' and r = o then return new; end if;

  foreach s in array secret loop
    if r ? s then r := jsonb_set(r, array[s], '"***"'); end if;
    if o ? s then o := jsonb_set(o, array[s], '"***"'); end if;
  end loop;

  insert into public.activity_log (actor, table_name, action, driver_id, row_data, old_data)
  values (
    coalesce(auth.jwt() ->> 'email', 'system'),
    tg_table_name,
    tg_op,
    nullif(coalesce(r, o) ->> key, '')::uuid,
    r,
    o
  );
  return coalesce(new, old);
end $$;

-- Clean secrets out of anything already logged
update public.activity_log
set row_data = row_data - 'share_token' - 'login_code' - 'bank_account' - 'bank_ifsc' - 'upi_id' - 'notes',
    old_data = old_data - 'share_token' - 'login_code' - 'bank_account' - 'bank_ifsc' - 'upi_id' - 'notes';

-- Only super admins can read admin-account history
drop policy if exists admin_read on public.activity_log;
create policy admin_read on public.activity_log for select to authenticated
  using (public.is_admin() and (table_name <> 'admins' or public.is_super_admin()));

-- ─────────────────────────────────────────────────────────────
-- 6. Storage: an admin cannot move files out of the media bucket
-- ─────────────────────────────────────────────────────────────
drop policy if exists media_admin_update on storage.objects;
create policy media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Check: new Driver IDs, and the portal hides bank details
-- ─────────────────────────────────────────────────────────────
select name, login_code, length(share_token) as token_len from public.drivers;
