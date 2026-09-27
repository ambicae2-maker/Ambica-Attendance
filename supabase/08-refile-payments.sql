-- Ambica Attendance — put existing payments under the salary month they paid for.
--
-- Salary for a month is paid on the pay day (5th) of the next month.
-- So a payment made on 5 Sept is August's salary, and one made on 4 Aug
-- (a day before July's pay day) is July's salary.
-- Rule: pick the salary month whose pay day is closest to the payment date
--       (a payment up to 7 days before a pay day counts for that pay day).

create or replace function public.salary_month_for_payment(p_paid_on date) returns date
language sql stable security definer set search_path = public as $$
  select case
    when (date_trunc('month', public.cycle_of(p_paid_on)) + interval '1 month')::date
         + (coalesce((select pay_day from public.company_settings where id = 1), 5) - 1)
         - p_paid_on <= 7
      then public.cycle_of(p_paid_on)
      else (public.cycle_of(p_paid_on) - interval '1 month')::date
  end;
$$;

-- STEP A — preview only (changes nothing): what would move where
select d.name as driver,
       p.paid_on,
       p.amount,
       to_char(p.month, 'Mon YYYY') as filed_under_now,
       to_char(public.salary_month_for_payment(p.paid_on), 'Mon YYYY') as should_be
from public.payments p
join public.drivers d on d.id = p.driver_id
order by d.name, p.paid_on;
