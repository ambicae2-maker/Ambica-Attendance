import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth, parseISO } from "date-fns";

/** Local date as yyyy-MM-dd. */
export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");
export const todayISO = () => toISODate(new Date());

/** First day of the month for a yyyy-MM-dd date → yyyy-MM-01. */
export const monthOf = (date: string) => `${date.slice(0, 7)}-01`;
export const currentMonth = () => monthOf(todayISO());

/*
 * ─────────────── Salary cycles ───────────────
 * Salary runs from the pay day of one month to the day before the pay day of the
 * next: with pay day 5, "September 2026" means 5 Sept → 4 Oct 2026, paid on 5 Oct.
 * A cycle is still named by its month (2026-09-01) so everything stays sortable.
 */
export const DEFAULT_PAY_DAY = 5;

/** First day of the cycle named `month` — e.g. 2026-09-01 + payDay 5 → 2026-09-05. */
export const cycleStart = (month: string, payDay: number) => dayDate(month, payDay);

/** Last day of that cycle — 4 Oct 2026 in the example. */
export const cycleEnd = (month: string, payDay: number) =>
  toISODate(addDays(parseISO(dayDate(shiftMonth(month, 1), payDay)), -1));

/** How many days the cycle covers (28–31). */
export const cycleLength = (month: string, payDay: number) =>
  differenceInCalendarDays(parseISO(cycleEnd(month, payDay)), parseISO(cycleStart(month, payDay))) + 1;

/** The day after the cycle ends — the day the salary is paid. */
export const cyclePayDate = (month: string, payDay: number) => dayDate(shiftMonth(month, 1), payDay);

/** Which cycle a date belongs to: 3 Oct with pay day 5 is still September's cycle. */
export const cycleOf = (date: string, payDay: number) =>
  Number(date.slice(8, 10)) >= payDay ? monthOf(date) : shiftMonth(monthOf(date), -1);

export const currentCycle = (payDay: number) => cycleOf(todayISO(), payDay);

/** Every date in the cycle, in order. */
export function cycleDates(month: string, payDay: number): string[] {
  const out: string[] = [];
  const n = cycleLength(month, payDay);
  const start = parseISO(cycleStart(month, payDay));
  for (let i = 0; i < n; i++) out.push(toISODate(addDays(start, i)));
  return out;
}

export const shiftMonth = (month: string, by: number) => toISODate(addMonths(parseISO(month), by));
export const daysIn = (month: string) => getDaysInMonth(parseISO(month));

export const dayDate = (month: string, day: number) => `${month.slice(0, 8)}${String(day).padStart(2, "0")}`;

/** Every month from `from` to `to` inclusive (both yyyy-MM-01). */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let m = monthOf(from);
  const end = monthOf(to);
  while (m <= end) {
    out.push(m);
    m = shiftMonth(m, 1);
  }
  return out;
}

const LOCALES: Record<string, string> = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" };

export function fmtMonth(month: string, lang = "en", short = false) {
  return new Intl.DateTimeFormat(LOCALES[lang] ?? "en-IN", { month: short ? "short" : "long", year: "numeric" }).format(
    parseISO(month),
  );
}

export function fmtDate(date: string, lang = "en", opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat(LOCALES[lang] ?? "en-IN", opts).format(parseISO(date));
}

export function weekdayNames(lang = "en") {
  // Monday-first, narrow names
  const base = parseISO("2024-01-01"); // a Monday
  const f = new Intl.DateTimeFormat(LOCALES[lang] ?? "en-IN", { weekday: "narrow" });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(base.getFullYear(), 0, 1 + i)));
}

/** Monday-based weekday index (0 = Mon) of any date. */
export const firstWeekday = (date: string) => (parseISO(date).getDay() + 6) % 7;

/** "5 Sept – 4 Oct 2026" — the dates a cycle covers, for headings. */
export function cycleLabel(month: string, payDay: number, lang = "en") {
  const from = fmtDate(cycleStart(month, payDay), lang, { day: "numeric", month: "short" });
  const to = fmtDate(cycleEnd(month, payDay), lang, { day: "numeric", month: "short", year: "numeric" });
  return `${from} – ${to}`;
}
