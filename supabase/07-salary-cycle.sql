-- Ambica Attendance — salary runs from pay day to pay day (5th → 4th).
-- Run once, after the earlier files. Safe to re-run.
--
-- A locked month must protect the days that belong to that CYCLE.
-- With pay day 5, "September 2026" covers 5 Sept → 4 Oct 2026, so 2 Oct
-- belongs to September and must stay protected while September is locked.

create or replace function public.cycle_of(p_date date) returns date
language sql stable security definer set search_path = public as $$
  select case
    when extract(day from p_date) >= coalesce((select pay_day from public.company_settings where id = 1), 5)
      then date_trunc('month', p_date)::date
      else (date_trunc('month', p_date) - interval '1 month')::date
  end;
$$;

create or replace function public.guard_locked_month() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  d uuid;
  m date;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  d := (r ->> 'driver_id')::uuid;
  m := case
         when tg_table_name = 'attendance' then public.cycle_of((r ->> 'date')::date)
         else public.cycle_of((r ->> 'date')::date)
       end;

  if exists (select 1 from public.payroll_months where driver_id = d and month = m) then
    raise exception 'MONTH_LOCKED: % is locked. Unlock it first.', to_char(m, 'Mon YYYY');
  end if;

  if tg_op = 'UPDATE' then
    m := public.cycle_of((to_jsonb(old) ->> 'date')::date);
    if exists (select 1 from public.payroll_months where driver_id = d and month = m) then
      raise exception 'MONTH_LOCKED: % is locked. Unlock it first.', to_char(m, 'Mon YYYY');
    end if;
  end if;

  return coalesce(new, old);
end $$;

-- Re-file any extras/advances that were saved under the calendar month
-- but belong to the previous cycle (dated the 1st–4th).
-- (only the label changes, so the locked-month guard is paused for this one update)
alter table public.adjustments disable trigger adjustments_guard;
update public.adjustments
set month = public.cycle_of(date)
where month is distinct from public.cycle_of(date);
alter table public.adjustments enable trigger adjustments_guard;

-- Check: cycle for a few dates (pay day 5 → 2 Oct belongs to September)
select '2026-10-02'::date as date, public.cycle_of('2026-10-02') as belongs_to
union all select '2026-10-05', public.cycle_of('2026-10-05')
union all select '2026-09-20', public.cycle_of('2026-09-20');
