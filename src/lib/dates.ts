import { addMonths, format, getDaysInMonth, parseISO } from "date-fns";

/** Local date as yyyy-MM-dd. */
export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");
export const todayISO = () => toISODate(new Date());

/** First day of the month for a yyyy-MM-dd date → yyyy-MM-01. */
export const monthOf = (date: string) => `${date.slice(0, 7)}-01`;
export const currentMonth = () => monthOf(todayISO());

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

/** Monday-based weekday index (0 = Mon) of the 1st of the month. */
export const firstWeekday = (month: string) => (parseISO(month).getDay() + 6) % 7;
