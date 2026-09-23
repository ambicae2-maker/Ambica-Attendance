-- Ambica Attendance — private share links for drivers.
--
-- Each driver gets a long random token (32 hex characters). The admin sends
-- https://<site>/d/<token> and the driver opens their own page with one tap —
-- no ID to type. Guessing someone else's link is not feasible (16 random bytes).
-- A link can be reset at any time, which instantly kills the old one.

alter table public.drivers
  add column if not exists share_token text not null default encode(gen_random_bytes(16), 'hex');

-- Give existing drivers a token (the default only applies to new rows).
update public.drivers set share_token = encode(gen_random_bytes(16), 'hex')
where share_token is null or length(share_token) < 32;

create unique index if not exists drivers_share_token_key on public.drivers (share_token);

-- The portal now accepts either the short Driver ID or the long share token.
create or replace function public.driver_portal(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d public.drivers;
  key text := trim(p_code);
begin
  select * into d from public.drivers
  where login_code = upper(key) or share_token = lower(key);
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

select name, login_code, share_token from public.drivers;
