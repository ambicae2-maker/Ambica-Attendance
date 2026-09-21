-- Ambica Attendance — full database schema.
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent where possible).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Admins (all admins are equal). Access is granted by email:
-- an admin adds an email here, that person signs up with it.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.admins (
  email      text primary key check (email = lower(email)),
  name       text not null default '',
  active     boolean not null default true,
  added_by   text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', '')) and active
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Company details (single row) — used on salary slips
-- ─────────────────────────────────────────────────────────────
create table if not exists public.company_settings (
  id         int primary key default 1 check (id = 1),
  name       text not null default 'Ambica Enterprise',
  address    text not null default '',
  gst_number text not null default '',
  phone      text not null default '',
  email      text not null default '',
  logo_url   text,
  pay_day    int  not null default 5 check (pay_day between 1 and 28),
  updated_at timestamptz not null default now()
);
insert into public.company_settings (id) values (1) on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- Drivers
-- ─────────────────────────────────────────────────────────────
create table if not exists public.drivers (
  id                 uuid primary key default gen_random_uuid(),
  login_code         text not null unique,
  name               text not null,
  phone              text,
  email              text,
  address            text,
  truck_number       text,
  photo_url          text,
  joining_date       date not null default current_date,
  left_on            date,
  active             boolean not null default true,
  overtime_hour_rate numeric(12,2),
  bank_account       text,
  bank_ifsc          text,
  upi_id             text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Salary changes apply from effective_from onward; earlier days keep the old rate.
create table if not exists public.salary_history (
  id             uuid primary key default gen_random_uuid(),
  driver_id      uuid not null references public.drivers(id) on delete cascade,
  monthly_salary numeric(12,2) not null check (monthly_salary >= 0),
  effective_from date not null,
  created_at     timestamptz not null default now(),
  unique (driver_id, effective_from)
);

-- Only non-default days are stored. A day with no row = present
-- (unless a company holiday falls on it).
create table if not exists public.attendance (
  driver_id  uuid not null references public.drivers(id) on delete cascade,
  date       date not null,
  status     text not null check (status in ('present', 'half', 'absent', 'holiday')),
  note       text,
  updated_at timestamptz not null default now(),
  primary key (driver_id, date)
);

-- Company-wide holidays (apply to every driver)
create table if not exists public.holidays (
  id   uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null
);

-- Extras & deductions. 'advance' = cash given to the driver; it is recovered
-- from salary automatically and any remainder carries to next month.
create table if not exists public.adjustments (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references public.drivers(id) on delete cascade,
  month      date not null check (extract(day from month) = 1),
  date       date not null,
  kind       text not null check (kind in ('bonus', 'allowance', 'overtime', 'deduction', 'advance')),
  unit       text check (unit in ('hour', 'day')),
  quantity   numeric(10,2),
  rate       numeric(12,2),
  amount     numeric(12,2) not null check (amount >= 0),
  note       text,
  created_at timestamptz not null default now()
);

-- Salary payments for a month (can be split, e.g. part cash + part UPI)
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references public.drivers(id) on delete cascade,
  month      date not null check (extract(day from month) = 1),
  amount     numeric(12,2) not null check (amount > 0),
  mode       text not null check (mode in ('cash', 'upi', 'bank', 'cheque')),
  reference  text,
  paid_on    date not null,
  note       text,
  created_at timestamptz not null default now()
);

-- A locked month freezes its calculation (snapshot) and blocks edits.
create table if not exists public.payroll_months (
  driver_id uuid not null references public.drivers(id) on delete cascade,
  month     date not null check (extract(day from month) = 1),
  snapshot  jsonb not null,
  locked_at timestamptz not null default now(),
  locked_by text,
  primary key (driver_id, month)
);

-- Activity log (written by triggers only)
create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      text,
  table_name text not null,
  action     text not null,
  driver_id  uuid,
  row_data   jsonb,
  old_data   jsonb
);
create index if not exists activity_log_at_idx on public.activity_log (at desc);

create index if not exists salary_history_driver_idx on public.salary_history (driver_id);
create index if not exists adjustments_driver_idx on public.adjustments (driver_id, month);
create index if not exists payments_driver_idx on public.payments (driver_id, month);

-- ─────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists drivers_touch on public.drivers;
create trigger drivers_touch before update on public.drivers
  for each row execute function public.touch_updated_at();
drop trigger if exists attendance_touch on public.attendance;
create trigger attendance_touch before insert or update on public.attendance
  for each row execute function public.touch_updated_at();

-- Block edits to attendance / adjustments inside a locked month.
create or replace function public.guard_locked_month() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  d uuid;
  m date;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  d := (r ->> 'driver_id')::uuid;
  m := date_trunc('month', (r ->> case when tg_table_name = 'attendance' then 'date' else 'month' end)::date)::date;
  if exists (select 1 from public.payroll_months where driver_id = d and month = m) then
    raise exception 'MONTH_LOCKED: % is locked. Unlock it first.', to_char(m, 'Mon YYYY');
  end if;
  if tg_op = 'UPDATE' then
    r := to_jsonb(old);
    m := date_trunc('month', (r ->> case when tg_table_name = 'attendance' then 'date' else 'month' end)::date)::date;
    if exists (select 1 from public.payroll_months where driver_id = d and month = m) then
      raise exception 'MONTH_LOCKED: % is locked. Unlock it first.', to_char(m, 'Mon YYYY');
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists attendance_guard on public.attendance;
create trigger attendance_guard before insert or update or delete on public.attendance
  for each row execute function public.guard_locked_month();
drop trigger if exists adjustments_guard on public.adjustments;
create trigger adjustments_guard before insert or update or delete on public.adjustments
  for each row execute function public.guard_locked_month();

-- Generic activity logger
create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  o jsonb;
  key text := case when tg_table_name = 'drivers' then 'id' else 'driver_id' end;
begin
  if tg_op <> 'DELETE' then r := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op = 'UPDATE' and r = o then return new; end if;
  insert into public.activity_log (actor, table_name, action, driver_id, row_data, old_data)
  values (
    coalesce(auth.jwt() ->> 'email', 'system'),
    tg_table_name,
    tg_op,
    nullif(coalesce(r, o) ->> key, '')::uuid,
    r - 'snapshot',
    o - 'snapshot'
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['drivers','salary_history','attendance','holidays','adjustments',
                           'payments','payroll_months','admins','company_settings'] loop
    execute format('drop trigger if exists %I_log on public.%I', t, t);
    execute format('create trigger %I_log after insert or update or delete on public.%I
                    for each row execute function public.log_activity()', t, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security: admins can do everything, nobody else can
-- touch tables directly. Drivers read through driver_portal().
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['admins','company_settings','drivers','salary_history','attendance',
                           'holidays','adjustments','payments','payroll_months'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated
                    using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.activity_log enable row level security;
drop policy if exists admin_read on public.activity_log;
create policy admin_read on public.activity_log for select to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Driver portal: a driver enters their ID and gets ONLY their data.
-- ─────────────────────────────────────────────────────────────
create or replace function public.driver_portal(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d public.drivers;
begin
  select * into d from public.drivers where login_code = upper(trim(p_code));
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'driver',         to_jsonb(d) - 'notes',
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
grant execute on function public.is_admin() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage: public bucket for driver photos + company logo.
-- File names are random UUIDs. Only admins can upload/delete.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_admin_select on storage.objects;
create policy media_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_insert on storage.objects;
create policy media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_update on storage.objects;
create policy media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_delete on storage.objects;
create policy media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- FIRST ADMIN — replace the email below, run it, then sign up in
-- the app (Admin tab → "First time? Create password") with it.
-- ─────────────────────────────────────────────────────────────
-- insert into public.admins (email, name) values ('owner@example.com', 'Owner');
