-- Ambica Attendance — keep the database small (free plan = 500 MB).
-- Run once, after the earlier files. Safe to re-run.
--
-- What this does:
--   1. The activity log stores only what actually changed, not whole rows.
--   2. Nothing is deleted automatically — a manual command exists if ever needed.
--   3. Locked-month snapshots drop the 30-day calendar (the app rebuilds it).
--   4. Adds a size report you can run any time.

-- ─────────────────────────────────────────────────────────────
-- 1. Activity log: store the changed fields only
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  o jsonb;
  changed jsonb := '{}'::jsonb;
  before  jsonb := '{}'::jsonb;
  key text := case when tg_table_name = 'drivers' then 'id' else 'driver_id' end;
  secret text[] := array['share_token', 'login_code', 'bank_account', 'bank_ifsc', 'upi_id', 'notes', 'snapshot'];
  s text;
  k text;
begin
  if tg_op <> 'DELETE' then r := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op = 'UPDATE' and r = o then return new; end if;

  -- never store secrets
  foreach s in array secret loop
    if r ? s then r := jsonb_set(r, array[s], '"***"'); end if;
    if o ? s then o := jsonb_set(o, array[s], '"***"'); end if;
  end loop;

  if tg_op = 'UPDATE' then
    -- keep only the fields that changed, plus enough to describe the row
    for k in select jsonb_object_keys(r) loop
      if r -> k is distinct from o -> k then
        changed := changed || jsonb_build_object(k, r -> k);
        before := before || jsonb_build_object(k, o -> k);
      end if;
    end loop;
    for k in select unnest(array['id', 'driver_id', 'name', 'date', 'month', 'email']) loop
      if r ? k then changed := changed || jsonb_build_object(k, r -> k); end if;
    end loop;
    r := changed;
    o := before;
  end if;

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

-- ─────────────────────────────────────────────────────────────
-- 2. Delete activity older than 12 months, every night
-- ─────────────────────────────────────────────────────────────
create or replace function public.prune_activity_log(keep_months int default 12)
returns integer language plpgsql security definer set search_path = public as $$
declare
  removed integer;
begin
  delete from public.activity_log where at < now() - make_interval(months => keep_months);
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function public.prune_activity_log(int) from public, anon;

-- NOTHING IS DELETED AUTOMATICALLY.
-- Attendance, salary, payments and advances are kept for ever.
-- The command above exists only if an admin ever wants to clear very old
-- change-history by hand, for example:  select public.prune_activity_log(36);
-- (that removes activity-log entries older than 3 years — never attendance).

-- ─────────────────────────────────────────────────────────────
-- 3. Shrink the locked-month snapshots already saved
--    (the app rebuilds the calendar from attendance)
-- ─────────────────────────────────────────────────────────────
update public.payroll_months
set snapshot = jsonb_set(snapshot, '{days}', '[]'::jsonb)
where jsonb_array_length(coalesce(snapshot -> 'days', '[]'::jsonb)) > 0;

-- ─────────────────────────────────────────────────────────────
-- 4. Size report — run this any time to see where space goes
-- ─────────────────────────────────────────────────────────────
create or replace function public.storage_report()
returns table (table_name text, rows bigint, size text) language sql security definer set search_path = public as $$
  select c.relname::text,
         c.reltuples::bigint,
         pg_size_pretty(pg_total_relation_size(c.oid))
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;
revoke all on function public.storage_report() from public, anon;
grant execute on function public.storage_report() to authenticated;

select pg_size_pretty(pg_database_size(current_database())) as database_total;
select * from public.storage_report();
