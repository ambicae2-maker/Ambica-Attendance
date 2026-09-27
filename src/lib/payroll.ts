/**
 * Salary engine — the single source of truth for every number shown in the app,
 * on the driver screen and on the salary slip.
 *
 * Rules (agreed with Ambica):
 *  - A salary month runs from the pay day to the day before the next pay day:
 *    with pay day 5, "September" = 5 Sept → 4 Oct, paid on 5 Oct.
 *  - Daily rate = monthly salary ÷ days in that cycle (28–31).
 *  - A day with nothing marked counts as Present.
 *  - Present / Holiday = full day's pay, Half day = half, Absent = nothing (all leave is unpaid).
 *  - Salary changes apply from their effective date; earlier days keep the old rate.
 *  - Days before joining / after leaving are not paid.
 *  - Current month counts only up to today ("live salary").
 *  - Advances are recovered from salary; whatever can't be recovered carries forward.
 *  - Locked (paid) months are frozen: their saved snapshot is used as-is.
 *  - Math is exact; each line is rounded to whole rupees and lines always add up.
 */
import { cycleDates, cycleEnd, cycleOf, cyclePayDate, DEFAULT_PAY_DAY, monthRange, todayISO } from "./dates";
import type { DayInfo, DayStatus, DriverData, MonthCalc } from "./types";

const FACTOR: Record<DayStatus, number> = { present: 1, holiday: 1, half: 0.5, absent: 0 };
const r = Math.round;

/**
 * Round several non-negative amounts to whole rupees so that they add up to
 * exactly `total` (already a whole number) — no part ever goes below zero and
 * each part is within ₹1 of its true value. (Largest-remainder method.)
 */
export function roundTogether(parts: number[], total: number): number[] {
  const floors = parts.map((p) => Math.floor(Math.max(0, p) + 1e-9));
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = parts
    .map((p, i) => ({ i, frac: Math.max(0, p) - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k].i] += 1;
  // (left can only be negative through float noise far below ₹1; take it off the largest part)
  while (left < 0) {
    const big = floors.indexOf(Math.max(...floors));
    floors[big] -= 1;
    left++;
  }
  return floors;
}

export function salaryOn(history: DriverData["salary_history"], date: string): number {
  if (!history.length) return 0;
  const sorted = [...history].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  let s = sorted[0].monthly_salary;
  for (const h of sorted) if (h.effective_from <= date) s = h.monthly_salary;
  return Number(s);
}

/** Build every month for one driver, from joining month to `today`'s month (or `until`). */
export function buildLedger(data: DriverData, until?: string, today = todayISO()): MonthCalc[] {
  const { driver } = data;
  const payDay = data.company?.pay_day ?? DEFAULT_PAY_DAY;
  const lastMonth = until ?? cycleOf(today, payDay);
  // A driver whose joining date is in the future still needs one month to show.
  const months = monthRange(cycleOf(driver.joining_date, payDay), lastMonth);
  if (!months.length) months.push(cycleOf(driver.joining_date, payDay));

  const attendance = new Map(data.attendance.map((a) => [a.date, a]));
  const holidays = new Map(data.holidays.map((h) => [h.date, h]));
  const locked = new Map(data.payroll_months.map((p) => [p.month, p]));

  const out: MonthCalc[] = [];
  let carry = 0;
  for (const month of months) {
    const snap = locked.get(month);
    let calc: MonthCalc;
    if (snap) {
      // Frozen month. If an earlier (unlocked) month changed after this one was
      // locked, keep that difference in the carry instead of losing it.
      const drift = carry - (snap.snapshot.advanceOpening ?? 0);
      // Money comes from the frozen snapshot; the calendar is rebuilt so the
      // snapshot itself stays tiny in the database.
      const live = calcMonth(data, month, carry, today, attendance, holidays);
      calc = {
        ...snap.snapshot,
        days: snap.snapshot.days?.length ? snap.snapshot.days : live.days,
        locked: true,
        ...paymentFields(data, month, snap.snapshot.net, snap.snapshot.dueDate, true),
      };
      carry = Math.max(0, calc.advanceClosing + drift) + calc.overpaid;
      out.push(calc);
      continue;
    }
    calc = calcMonth(data, month, carry, today, attendance, holidays);
    out.push(calc);
    carry = calc.advanceClosing + calc.overpaid;
  }
  return out;
}

export function monthFor(data: DriverData, month: string, today = todayISO()): MonthCalc {
  // Always build the chain up to the wanted month, so advances carry correctly and
  // a month outside the "today" range is still calculated with its real attendance.
  const payDay = data.company?.pay_day ?? DEFAULT_PAY_DAY;
  const ledger = buildLedger(data, month > cycleOf(today, payDay) ? month : undefined, today);
  return ledger.find((m) => m.month === month) ?? emptyMonth(data, month, today);
}

function paymentFields(data: DriverData, month: string, net: number, dueDate: string, finished = true) {
  const paid = r(data.payments.filter((p) => p.month === month).reduce((s, p) => s + Number(p.amount), 0));
  const due = Math.max(0, net - paid);
  // Only once the month has ended is anything paid above the salary treated as
  // extra money to recover; mid-month the salary is still growing.
  const overpaid = finished ? Math.max(0, paid - net) : 0;
  let payStatus: MonthCalc["payStatus"];
  if (net <= 0 && paid === 0) payStatus = "none";
  else if (due === 0) payStatus = "paid";
  else payStatus = paid > 0 ? "partial" : "unpaid";
  return { paid, due, overpaid, payStatus, dueDate };
}

function calcMonth(
  data: DriverData,
  month: string,
  advanceOpening: number,
  today: string,
  attendance: Map<string, DriverData["attendance"][number]>,
  holidays: Map<string, DriverData["holidays"][number]>,
): MonthCalc {
  const { driver } = data;
  const payDay = data.company?.pay_day ?? DEFAULT_PAY_DAY;
  const dates = cycleDates(month, payDay);
  const n = dates.length;
  const days: DayInfo[] = [];
  // Count DAYS per salary rate, then divide once at the end. Adding up many
  // small decimals one by one can drift by a fraction of a paisa, which is
  // enough to flip a ".50" and make the salary ₹1 off. Days are whole or half
  // numbers, so these tallies are exact.
  type Tally = { full: number; pending: number; absent: number; half: number; paid: number };
  const bySalary = new Map<number, Tally>();
  const tally = (monthly: number) => {
    const existing = bySalary.get(monthly);
    if (existing) return existing;
    const fresh = { full: 0, pending: 0, absent: 0, half: 0, paid: 0 };
    bySalary.set(monthly, fresh);
    return fresh;
  };
  const counts = { present: 0, half: 0, absent: 0, holiday: 0, upcoming: 0, employed: 0 };
  const rates = new Set<number>();
  let lastEmployedSalary = 0;

  for (const date of dates) {
    const d = Number(date.slice(8, 10));
    const employed = date >= driver.joining_date && (!driver.left_on || date <= driver.left_on);
    const future = date > today;
    const marked = attendance.get(date);
    const hol = holidays.get(date);
    const status: DayStatus = marked?.status ?? (hol ? "holiday" : "present");
    const source: DayInfo["source"] = marked ? "marked" : hol ? "company" : "default";
    const monthly = employed ? salaryOn(data.salary_history, date) : 0;
    const rate = monthly / n;

    days.push({ date, day: d, status, source, employed, future, rate, note: marked?.note, holidayName: hol?.name });
    if (!employed) continue;

    rates.add(monthly);
    lastEmployedSalary = monthly;
    counts.employed++;
    const t = tally(monthly);
    t.full += 1;
    if (future) {
      t.pending += 1;
      counts.upcoming++;
      continue;
    }
    counts[status]++;
    t.paid += FACTOR[status];
    if (status === "absent") t.absent += 1;
    if (status === "half") t.half += 0.5;
  }

  // salary × days ÷ days-in-period, summed over the (usually one) salary rate
  const money = (key: keyof Tally) => {
    let total = 0;
    for (const [monthly, t] of bySalary) total += monthly * t[key];
    return total / n;
  };
  const full = money("full");
  const pending = money("pending");
  const absentDed = money("absent");
  const halfDed = money("half");
  const basic = money("paid");

  const adj = data.adjustments.filter((a) => (a.date ? cycleOf(a.date, payDay) : a.month) === month);
  const sum = (k: string) => r(adj.filter((a) => a.kind === k).reduce((s, a) => s + Number(a.amount), 0));
  const bonus = sum("bonus"), allowance = sum("allowance"), overtime = sum("overtime");
  const otherDeduction = sum("deduction"), advanceGiven = sum("advance");

  // The salary earned is the exact figure rounded normally, so it always equals
  // "days paid × pay per day" as shown on the statement. The smaller lines
  // (leave, days still to come) share out the rest so everything adds up to the
  // full-month figure exactly, and none of them can go below zero.
  const fullMonth = r(full);
  const basicEarned = Math.min(r(basic), fullMonth);
  const [absentDeduction, halfDeduction, pendingR] = roundTogether([absentDed, halfDed, pending], fullMonth - basicEarned);

  // Deductions can never push pay below zero: whatever cannot be taken this
  // month is carried to the next one (same as an advance).
  const earnings = basicEarned + bonus + allowance + overtime;
  const deductionApplied = Math.min(otherDeduction, Math.max(0, earnings));
  const deductionCarried = otherDeduction - deductionApplied;
  const gross = earnings - deductionApplied;
  const available = advanceOpening + advanceGiven;
  const advanceRecovered = Math.min(available, gross);
  const net = gross - advanceRecovered;
  const monthlySalary = r(lastEmployedSalary || salaryOn(data.salary_history, cycleEnd(month, payDay)));
  const dueDate = cyclePayDate(month, payDay); // the day right after the cycle ends

  return {
    month,
    daysInMonth: n,
    complete: cycleEnd(month, payDay) < today,
    locked: false,
    monthlySalary,
    dailyRate: r(monthlySalary / n),
    salaryChanged: rates.size > 1,
    days,
    counts,
    fullMonth,
    pending: pendingR,
    absentDeduction,
    halfDeduction,
    basicEarned,
    bonus,
    allowance,
    overtime,
    otherDeduction,
    deductionApplied,
    deductionCarried,
    gross,
    advanceOpening,
    advanceGiven,
    advanceRecovered,
    // whatever could not be taken this month rolls into next month's opening balance
    advanceClosing: available - advanceRecovered + deductionCarried,
    net,
    ...paymentFields(data, month, net, dueDate, cycleEnd(month, payDay) < today),
  };
}

function emptyMonth(data: DriverData, month: string, today: string): MonthCalc {
  return calcMonth(data, month, 0, today, new Map(), new Map(data.holidays.map((h) => [h.date, h])));
}

/** Pay earned for a single day (for "+₹X today" hints). */
export function dayPay(day: DayInfo) {
  return day.employed && !day.future ? day.rate * FACTOR[day.status] : 0;
}

export const STATUS_ORDER: DayStatus[] = ["present", "half", "absent", "holiday"];
