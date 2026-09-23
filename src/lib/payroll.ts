/**
 * Salary engine — the single source of truth for every number shown in the app,
 * on the driver screen and on the salary slip.
 *
 * Rules (agreed with Ambica):
 *  - Daily rate = monthly salary ÷ days in that month (28–31).
 *  - A day with nothing marked counts as Present.
 *  - Present / Holiday = full day's pay, Half day = half, Absent = nothing (all leave is unpaid).
 *  - Salary changes apply from their effective date; earlier days keep the old rate.
 *  - Days before joining / after leaving are not paid.
 *  - Current month counts only up to today ("live salary").
 *  - Advances are recovered from salary; whatever can't be recovered carries forward.
 *  - Locked (paid) months are frozen: their saved snapshot is used as-is.
 *  - Math is exact; each line is rounded to whole rupees and lines always add up.
 */
import { dayDate, daysIn, monthOf, monthRange, shiftMonth, todayISO } from "./dates";
import type { DayInfo, DayStatus, DriverData, MonthCalc } from "./types";

const FACTOR: Record<DayStatus, number> = { present: 1, holiday: 1, half: 0.5, absent: 0 };
const r = Math.round;

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
  const lastMonth = until ?? monthOf(today);
  // A driver whose joining date is in the future still needs one month to show.
  const months = monthRange(monthOf(driver.joining_date), lastMonth);
  if (!months.length) months.push(monthOf(driver.joining_date));

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
      calc = {
        ...snap.snapshot,
        locked: true,
        ...paymentFields(data, month, snap.snapshot.net, snap.snapshot.dueDate),
      };
      carry = Math.max(0, calc.advanceClosing + drift);
      out.push(calc);
      continue;
    }
    calc = calcMonth(data, month, carry, today, attendance, holidays);
    out.push(calc);
    carry = calc.advanceClosing;
  }
  return out;
}

export function monthFor(data: DriverData, month: string, today = todayISO()): MonthCalc {
  // Always build the chain up to the wanted month, so advances carry correctly and
  // a month outside the "today" range is still calculated with its real attendance.
  const ledger = buildLedger(data, month > monthOf(today) ? month : undefined, today);
  return ledger.find((m) => m.month === month) ?? emptyMonth(data, month, today);
}

function paymentFields(data: DriverData, month: string, net: number, dueDate: string) {
  const paid = r(data.payments.filter((p) => p.month === month).reduce((s, p) => s + Number(p.amount), 0));
  const due = Math.max(0, net - paid);
  const payStatus: MonthCalc["payStatus"] = net <= 0 && paid === 0 ? "none" : due === 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
  return { paid, due, payStatus, dueDate };
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
  const n = daysIn(month);
  const days: DayInfo[] = [];
  let full = 0, pending = 0, absentDed = 0, halfDed = 0, basic = 0;
  const counts = { present: 0, half: 0, absent: 0, holiday: 0, upcoming: 0, employed: 0 };
  const rates = new Set<number>();
  let lastEmployedSalary = 0;

  for (let d = 1; d <= n; d++) {
    const date = dayDate(month, d);
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
    full += rate;
    if (future) {
      pending += rate;
      counts.upcoming++;
      continue;
    }
    counts[status]++;
    basic += rate * FACTOR[status];
    if (status === "absent") absentDed += rate;
    if (status === "half") halfDed += rate / 2;
  }

  const adj = data.adjustments.filter((a) => a.month === month);
  const sum = (k: string) => r(adj.filter((a) => a.kind === k).reduce((s, a) => s + Number(a.amount), 0));
  const bonus = sum("bonus"), allowance = sum("allowance"), overtime = sum("overtime");
  const otherDeduction = sum("deduction"), advanceGiven = sum("advance");

  // "Full month pay" is the exact figure; the other lines are rounded and the
  // basic is derived from them, so every line on the slip adds up exactly.
  const fullMonth = r(full);
  const absentDeduction = r(absentDed);
  const halfDeduction = r(halfDed);
  const pendingR = r(pending);
  const basicEarned = fullMonth - absentDeduction - halfDeduction - pendingR;

  // Deductions can never push pay below zero: whatever cannot be taken this
  // month is carried to the next one (same as an advance).
  const earnings = basicEarned + bonus + allowance + overtime;
  const deductionApplied = Math.min(otherDeduction, Math.max(0, earnings));
  const deductionCarried = otherDeduction - deductionApplied;
  const gross = earnings - deductionApplied;
  const available = advanceOpening + advanceGiven;
  const advanceRecovered = Math.min(available, gross);
  const net = gross - advanceRecovered;
  const monthlySalary = r(lastEmployedSalary || salaryOn(data.salary_history, dayDate(month, n)));
  const payDay = data.company?.pay_day ?? 5;
  const dueDate = dayDate(shiftMonth(month, 1), payDay);

  return {
    month,
    daysInMonth: n,
    complete: dayDate(month, n) < today,
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
    ...paymentFields(data, month, net, dueDate),
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
