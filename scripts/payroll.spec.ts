/*
 * Salary engine test suite — run with: npm test
 *
 * A salary month runs from the pay day to the day before the next pay day.
 * With pay day 5, "September 2026" means 5 Sept → 4 Oct 2026, paid on 5 Oct.
 */
import { buildLedger, monthFor, roundTogether, salaryOn } from "../src/lib/payroll";
import { cycleDates, cycleEnd, cycleLength, cycleOf, cycleStart } from "../src/lib/dates";
import type { DriverData, MonthCalc } from "../src/lib/types";

const PAY_DAY = 5;
let pass = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean, got?: unknown) => {
  if (cond) pass++;
  else fails.push(`${name} — got ${JSON.stringify(got)}`);
};
const eq = (name: string, a: unknown, b: unknown) => ok(`${name} (expected ${JSON.stringify(b)})`, a === b, a);

interface Over {
  driver?: Partial<DriverData["driver"]>;
  salary?: { monthly_salary: number; effective_from: string }[];
  att?: { date: string; status: string; note?: string | null }[];
  hol?: { date: string; name: string }[];
  adj?: Record<string, unknown>[];
  pay?: Record<string, unknown>[];
  locked?: { month: string; snapshot: MonthCalc }[];
  payDay?: number;
}
const data = (o: Over = {}): DriverData =>
  ({
    driver: { id: "d", name: "T", joining_date: "2026-01-01", left_on: null, active: true, overtime_hour_rate: null, ...o.driver },
    salary_history: (o.salary ?? [{ monthly_salary: 30000, effective_from: "2026-01-01" }]).map((s, i) => ({ id: "s" + i, driver_id: "d", ...s })),
    attendance: (o.att ?? []).map((a) => ({ driver_id: "d", note: null, ...a })),
    holidays: (o.hol ?? []).map((h, i) => ({ id: "h" + i, ...h })),
    adjustments: (o.adj ?? []).map((a, i) => ({
      id: "a" + i,
      driver_id: "d",
      month: cycleOf(String(a.date), o.payDay ?? PAY_DAY),
      unit: null,
      quantity: null,
      rate: null,
      note: null,
      ...a,
    })),
    payments: (o.pay ?? []).map((p, i) => ({ id: "p" + i, driver_id: "d", mode: "cash", reference: null, note: null, ...p })),
    payroll_months: (o.locked ?? []).map((l) => ({ driver_id: "d", ...l })),
    company: { id: 1, name: "C", address: "", gst_number: "", phone: "", email: "", logo_url: null, pay_day: o.payDay ?? PAY_DAY },
  }) as unknown as DriverData;

const M = (d: DriverData, month: string, today = "2026-12-31") => monthFor(d, month, today);
const len = (month: string) => cycleLength(month, PAY_DAY);
const dayRate = (salary: number, month: string) => Math.round(salary / len(month));

// ─────────────────────────────────────────────────────────────
// 1. The cycle itself
// ─────────────────────────────────────────────────────────────
{
  eq("September starts on the 5th", cycleStart("2026-09-01", PAY_DAY), "2026-09-05");
  eq("September ends on 4 Oct", cycleEnd("2026-09-01", PAY_DAY), "2026-10-04");
  eq("September is 30 days", len("2026-09-01"), 30);
  eq("February cycle is 28 days", len("2026-02-01"), 28);
  eq("2 Oct still belongs to September", cycleOf("2026-10-02", PAY_DAY), "2026-09-01");
  eq("5 Oct starts October", cycleOf("2026-10-05", PAY_DAY), "2026-10-01");
  eq("4 Oct is the last September day", cycleOf("2026-10-04", PAY_DAY), "2026-09-01");
  eq("first day of the list", cycleDates("2026-09-01", PAY_DAY)[0], "2026-09-05");
  eq("last day of the list", cycleDates("2026-09-01", PAY_DAY).at(-1), "2026-10-04");

  const m = M(data(), "2026-09-01");
  eq("calendar starts on the 5th", m.days[0].date, "2026-09-05");
  eq("calendar ends on the 4th", m.days.at(-1)!.date, "2026-10-04");
  eq("salary is paid the day after the cycle ends", m.dueDate, "2026-10-05");
  eq("a full cycle pays the full salary", m.net, 30000);
}

// 2. Absences land in the right cycle, including days after the 1st
{
  const early = M(data({ att: [{ date: "2026-09-06", status: "absent" }] }), "2026-09-01");
  eq("absence on 6 Sept hits September", early.counts.absent, 1);
  eq("one day cut", early.net, 30000 - dayRate(30000, "2026-09-01"));

  const late = M(data({ att: [{ date: "2026-10-02", status: "absent" }] }), "2026-09-01");
  eq("absence on 2 Oct also hits September", late.counts.absent, 1);
  eq("same cut", late.net, 30000 - dayRate(30000, "2026-09-01"));

  const next = M(data({ att: [{ date: "2026-10-02", status: "absent" }] }), "2026-10-01");
  eq("and not October", next.counts.absent, 0);
  eq("October untouched", next.net, 30000);

  const half = M(data({ att: [{ date: "2026-09-20", status: "half" }] }), "2026-09-01");
  eq("half day cuts half a day", half.net, 30000 - Math.round(dayRate(30000, "2026-09-01") / 2));
}

// 3. Leap year inside a cycle
{
  const feb = M(data({ att: [{ date: "2028-02-29", status: "absent" }] }), "2028-02-01", "2028-12-31");
  eq("Feb 2028 cycle covers the leap day", feb.counts.absent, 1);
  eq("cycle length", feb.daysInMonth, cycleLength("2028-02-01", PAY_DAY));
  eq("leap day deduction", feb.net, 30000 - Math.round(30000 / feb.daysInMonth));
}

// 4. Holidays
{
  const hol = M(data({ hol: [{ date: "2026-09-25", name: "Diwali" }] }), "2026-09-01");
  eq("holiday counted", hol.counts.holiday, 1);
  eq("holiday is paid", hol.net, 30000);

  const spill = M(data({ hol: [{ date: "2026-10-02", name: "Gandhi Jayanti" }] }), "2026-09-01");
  eq("holiday after the 1st belongs to this cycle", spill.counts.holiday, 1);
  eq("still full pay", spill.net, 30000);
}

// 5. Salary change inside a cycle is day-wise
{
  const d = data({
    salary: [{ monthly_salary: 20000, effective_from: "2026-01-01" }, { monthly_salary: 26000, effective_from: "2026-09-15" }],
  });
  const m = M(d, "2026-09-01");
  const dates = cycleDates("2026-09-01", PAY_DAY);
  const n = dates.length;
  const expected = Math.round(dates.reduce((sum, date) => sum + (date >= "2026-09-15" ? 26000 : 20000) / n, 0));
  eq("day-by-day across the change", m.basicEarned, expected);
  ok("flagged as changed", m.salaryChanged === true, m.salaryChanged);
  eq("salaryOn before", salaryOn(d.salary_history, "2026-09-14"), 20000);
  eq("salaryOn after", salaryOn(d.salary_history, "2026-09-15"), 26000);
}

// 6. Joining and leaving
{
  const joined = M(data({ driver: { joining_date: "2026-09-20" } }), "2026-09-01");
  const worked = cycleDates("2026-09-01", PAY_DAY).filter((x) => x >= "2026-09-20").length;
  eq("only days from joining", joined.counts.employed, worked);
  eq("pay for those days", joined.net, Math.round((worked * 30000) / len("2026-09-01")));

  const left = M(data({ driver: { left_on: "2026-09-19", active: false } }), "2026-09-01");
  const upto = cycleDates("2026-09-01", PAY_DAY).filter((x) => x <= "2026-09-19").length;
  eq("stops at the leaving date", left.counts.employed, upto);
  eq("cycle after leaving is zero", M(data({ driver: { left_on: "2026-09-19" } }), "2026-10-01").net, 0);
}

// 7. Live pay: only days up to today
{
  const today = "2026-09-14"; // 10 days into the September cycle
  const m = M(data(), "2026-09-01", today);
  const rate = 30000 / len("2026-09-01");
  eq("earned so far", m.basicEarned, Math.round(10 * rate));
  eq("rest is pending", m.pending, Math.round(20 * rate));
  ok("not complete yet", m.complete === false, m.complete);

  const planned = M(data({ att: [{ date: "2026-10-01", status: "absent" }] }), "2026-09-01", today);
  eq("a future absence does not reduce today's pay", planned.basicEarned, m.basicEarned);
}

// 8. Advances chain across cycles
{
  const d = data({ adj: [{ date: "2026-09-06", kind: "advance", amount: 70000 }] });
  const l = buildLedger(d, undefined, "2026-12-31");
  const sep = l.find((m) => m.month === "2026-09-01")!;
  const oct = l.find((m) => m.month === "2026-10-01")!;
  const nov = l.find((m) => m.month === "2026-11-01")!;
  eq("September pays nothing", sep.net, 0);
  eq("carry after September", sep.advanceClosing, 40000);
  eq("October opens with it", oct.advanceOpening, 40000);
  eq("carry after October", oct.advanceClosing, 10000);
  eq("November clears it", nov.advanceRecovered, 10000);
  eq("November pays the rest", nov.net, 20000);

  const spill = M(data({ adj: [{ date: "2026-10-02", kind: "advance", amount: 5000 }] }), "2026-09-01");
  eq("advance after the 1st is in this cycle", spill.advanceGiven, 5000);
  eq("and is recovered here", spill.advanceRecovered, 5000);
  eq("net after recovery", spill.net, 25000);
}

// 9. Extras and deductions
{
  const m = M(
    data({
      adj: [
        { date: "2026-09-10", kind: "bonus", amount: 2000 },
        { date: "2026-09-11", kind: "allowance", amount: 1500 },
        { date: "2026-10-01", kind: "overtime", amount: 900, unit: "hour", quantity: 6, rate: 150 },
        { date: "2026-09-12", kind: "deduction", amount: 400 },
      ],
    }),
    "2026-09-01",
  );
  eq("bonus", m.bonus, 2000);
  eq("allowance", m.allowance, 1500);
  eq("overtime dated 1 Oct still counts here", m.overtime, 900);
  eq("deduction", m.otherDeduction, 400);
  eq("net", m.net, 30000 + 2000 + 1500 + 900 - 400);
}

// 10. Deduction bigger than the pay carries forward
{
  const d = data({ adj: [{ date: "2026-09-10", kind: "deduction", amount: 50000 }] });
  const m = M(d, "2026-09-01");
  eq("never negative", m.net, 0);
  eq("only what fits is taken", m.deductionApplied, 30000);
  eq("rest carried", m.deductionCarried, 20000);
  const oct = buildLedger(d, undefined, "2026-12-31").find((x) => x.month === "2026-10-01")!;
  eq("October opens with the rest", oct.advanceOpening, 20000);
  eq("October pays the remainder", oct.net, 10000);
}

// 11. Payments and status
{
  eq("unpaid", M(data(), "2026-09-01").payStatus, "unpaid");
  const part = M(data({ pay: [{ month: "2026-09-01", amount: 10000, paid_on: "2026-10-05" }] }), "2026-09-01");
  eq("partly paid", part.payStatus, "partial");
  eq("balance", part.due, 20000);
  const full = M(data({ pay: [{ month: "2026-09-01", amount: 30000, paid_on: "2026-10-05" }] }), "2026-09-01");
  eq("paid", full.payStatus, "paid");
  eq("nothing due", full.due, 0);
}

// 12. Locked cycles stay frozen
{
  const snapshot = M(data({ att: [{ date: "2026-09-06", status: "absent" }] }), "2026-09-01");
  const after = data({
    salary: [{ monthly_salary: 30000, effective_from: "2026-01-01" }, { monthly_salary: 90000, effective_from: "2026-09-01" }],
    att: [{ date: "2026-09-06", status: "absent" }, { date: "2026-09-07", status: "absent" }],
    locked: [{ month: "2026-09-01", snapshot }],
  });
  const m = M(after, "2026-09-01");
  eq("frozen net", m.net, snapshot.net);
  ok("marked locked", m.locked === true, m.locked);
  ok("calendar is rebuilt from attendance", m.days.length === len("2026-09-01"), m.days.length);
}

// 13. A different pay day still works (pay day 1 = plain calendar months)
{
  const d = data({ payDay: 1 });
  const m = M(d, "2026-09-01");
  eq("pay day 1 starts on the 1st", m.days[0].date, "2026-09-01");
  eq("and ends on the 30th", m.days.at(-1)!.date, "2026-09-30");
  eq("paid on 1 Oct", m.dueDate, "2026-10-01");
}

// 14. Safety: no crashes on odd data
{
  const future = buildLedger(data({ driver: { joining_date: "2027-05-10" } }), undefined, "2026-09-23");
  ok("future joiner gives a ledger", future.length >= 1, future.length);
  eq("and earns nothing yet", future[0].net, 0);

  const none = data();
  none.salary_history = [];
  const m = M(none, "2026-09-01");
  eq("no salary history → 0", m.net, 0);
  ok("no NaN", Number.isFinite(m.fullMonth), m.fullMonth);
}

// ─────────────────────────────────────────────────────────────
// 15. Property tests: 2000 random cycles must always balance
// ─────────────────────────────────────────────────────────────
{
  let bad = 0;
  const rnd = (n: number) => Math.floor(Math.random() * n);
  for (let i = 0; i < 2000; i++) {
    const month = `2026-${String(1 + rnd(12)).padStart(2, "0")}-01`;
    const dates = cycleDates(month, PAY_DAY);
    const salary = 5000 + rnd(120000);
    const marks = new Map<string, { date: string; status: string }>();
    for (let k = 0; k < rnd(10); k++) {
      const date = dates[rnd(dates.length)];
      marks.set(date, { date, status: ["present", "half", "absent", "holiday"][rnd(4)] });
    }
    const d = data({
      salary: [{ monthly_salary: salary, effective_from: "2026-01-01" }],
      att: [...marks.values()],
      adj: [
        ...(rnd(2) ? [{ date: dates[rnd(dates.length)], kind: "bonus", amount: rnd(5000) }] : []),
        ...(rnd(2) ? [{ date: dates[rnd(dates.length)], kind: "advance", amount: rnd(60000) }] : []),
        ...(rnd(3) === 0 ? [{ date: dates[rnd(dates.length)], kind: "deduction", amount: rnd(3000) }] : []),
      ],
    });
    const m = M(d, month);

    const checks = [
      m.basicEarned + m.absentDeduction + m.halfDeduction + m.pending === m.fullMonth,
      m.gross === m.basicEarned + m.bonus + m.allowance + m.overtime - m.deductionApplied && m.gross >= 0,
      m.deductionApplied + m.deductionCarried === m.otherDeduction,
      m.net === Math.max(0, m.gross - m.advanceRecovered),
      m.advanceClosing === m.advanceOpening + m.advanceGiven - m.advanceRecovered + m.deductionCarried && m.advanceClosing >= 0,
      [m.fullMonth, m.basicEarned, m.net, m.gross, m.advanceRecovered, m.paid, m.due].every(Number.isInteger),
      m.basicEarned >= 0 && m.basicEarned <= m.fullMonth,
      m.days.length === dates.length && m.days[0].date === dates[0],
      // statement identity: credits − debits = what is owed
      m.fullMonth +
        m.bonus +
        m.allowance +
        m.overtime -
        (m.absentDeduction + m.halfDeduction + m.pending + m.deductionApplied + m.advanceRecovered) ===
        m.net,
    ];
    if (!checks.every(Boolean)) {
      bad++;
      if (bad <= 3) fails.push(`property fail: ${JSON.stringify({ month, salary, checks })}`);
    }
  }
  ok(`2000 random cycles balance (${bad} bad)`, bad === 0, bad);
}

// ─────────────────────────────────────────────────────────────
// 16. Rounding can never go below zero and always adds up exactly
// ─────────────────────────────────────────────────────────────
{
  let bad = 0;
  for (let i = 0; i < 20000; i++) {
    const n = 1 + Math.floor(Math.random() * 4);
    const parts = Array.from({ length: n }, () => (Math.random() < 0.2 ? 0 : Math.random() * 50000));
    const total = Math.round(parts.reduce((a, b) => a + b, 0));
    const got = roundTogether(parts, total);
    const sum = got.reduce((a, b) => a + b, 0);
    if (sum !== total || got.some((g, k) => g < 0 || Math.abs(g - parts[k]) >= 1 + 1e-9 || !Number.isInteger(g))) bad++;
  }
  ok("20,000 rounding cases: exact total, never negative, within ₹1", bad === 0, bad);
}

// 17. A driver absent the whole month gets zero — never minus
{
  for (const month of ["2026-02-01", "2026-03-01", "2026-09-01", "2028-02-01"]) {
    for (const salary of [9999, 16000, 18333, 30000, 47777]) {
      const all = cycleDates(month, PAY_DAY).map((date) => ({ date, status: "absent" }));
      const d = data({ salary: [{ monthly_salary: salary, effective_from: "2025-01-01" }], driver: { joining_date: "2025-01-01" }, att: all });
      const m = M(d, month, "2030-01-01");
      ok(`all absent ${month} @${salary} gives 0`, m.basicEarned === 0 && m.net === 0 && m.absentDeduction === m.fullMonth, {
        basic: m.basicEarned,
        net: m.net,
      });
    }
  }
}

// 18. The exact case from the screenshot: ₹16,000 salary, paid ₹16,000 twice
{
  const d = data({
    salary: [{ monthly_salary: 16000, effective_from: "2026-01-01" }],
    pay: [
      { month: "2026-08-01", amount: 16000, paid_on: "2026-09-05" },
      { month: "2026-08-01", amount: 16000, paid_on: "2026-09-05" },
    ],
  });
  const l = buildLedger(d, undefined, "2026-12-31");
  const aug = l.find((m) => m.month === "2026-08-01")!;
  const sep = l.find((m) => m.month === "2026-09-01")!;
  ok(
    "nothing is ever negative",
    l.every((m) => m.net >= 0 && m.due >= 0 && m.basicEarned >= 0 && m.advanceClosing >= 0),
    l.map((m) => m.net),
  );
  eq("August fully paid", aug.due, 0);
  eq("the extra 16,000 is noted", aug.overpaid, 16000);
  eq("and recovered in September", sep.advanceOpening, 16000);
  eq("September pays nothing more", sep.net, 0);

  const early = M(
    data({ salary: [{ monthly_salary: 16000, effective_from: "2026-01-01" }], pay: [{ month: "2026-09-01", amount: 16000, paid_on: "2026-09-20" }] }),
    "2026-09-01",
    "2026-09-20",
  );
  eq("mid-month: no over-payment yet", early.overpaid, 0);
  eq("mid-month: balance shows 0, not minus", early.due, 0);
}

// ─────────────────────────────────────────────────────────────
// 19. INDEPENDENT CHECK: a second calculator written a different way
//     (its own date maths, plain loops, no shared helpers) must agree
//     with the engine on thousands of random multi-month histories.
// ─────────────────────────────────────────────────────────────
{
  const iso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const addDaysJs = (s: string, n: number) => {
    const [y, mo, da] = s.split("-").map(Number);
    return iso(new Date(y, mo - 1, da + n));
  };
  const monthKey = (y: number, mo: number) => iso(new Date(y, mo, 1));
  const ownCycle = (s: string) => {
    const [y, mo, da] = s.split("-").map(Number);
    return da >= PAY_DAY ? monthKey(y, mo - 1) : monthKey(y, mo - 2);
  };
  const ownDates = (month: string) => {
    const [y, mo] = month.split("-").map(Number);
    const out: string[] = [];
    let cur = iso(new Date(y, mo - 1, PAY_DAY));
    const stop = iso(new Date(y, mo, PAY_DAY)); // exclusive
    while (cur < stop) {
      out.push(cur);
      cur = addDaysJs(cur, 1);
    }
    return out;
  };
  const salaryAt = (hist: { monthly_salary: number; effective_from: string }[], date: string) => {
    const sorted = [...hist].sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1));
    let v = sorted[0].monthly_salary;
    for (const h of sorted) if (h.effective_from <= date) v = h.monthly_salary;
    return v;
  };

  const rnd = (n: number) => Math.floor(Math.random() * n);
  const pick = <T,>(xs: T[]) => xs[rnd(xs.length)];
  let mismatches = 0;
  let scenarios = 0;
  let monthsChecked = 0;

  for (let run = 0; run < 3000; run++) {
    scenarios++;
    const join = iso(new Date(2026, rnd(6), 1 + rnd(28)));
    const today = iso(new Date(2026, 6 + rnd(6), 1 + rnd(28)));
    const leftOn = rnd(5) === 0 ? addDaysJs(join, 40 + rnd(150)) : null;
    const hist = [{ monthly_salary: 8000 + rnd(60000), effective_from: join }];
    if (rnd(2)) hist.push({ monthly_salary: 8000 + rnd(60000), effective_from: addDaysJs(join, 10 + rnd(150)) });

    const span: string[] = [];
    for (let k = 0; k < 400; k++) span.push(addDaysJs(join, k));
    const marks = new Map<string, string>();
    for (let k = 0; k < rnd(40); k++) marks.set(pick(span), pick(["present", "half", "absent", "holiday"]));
    const hols = new Map<string, string>();
    for (let k = 0; k < rnd(6); k++) hols.set(pick(span), "Holiday");
    const adj: Record<string, unknown>[] = [];
    for (let k = 0; k < rnd(12); k++) {
      adj.push({ date: pick(span.filter((x) => x <= today).length ? span.filter((x) => x <= today) : span), kind: pick(["bonus", "allowance", "overtime", "deduction", "advance"]), amount: rnd(20000) });
    }

    const d = data({
      driver: { joining_date: join, left_on: leftOn },
      salary: hist,
      att: [...marks].map(([date, status]) => ({ date, status })),
      hol: [...hols].map(([date, name]) => ({ date, name })),
      adj,
    });

    const cycles: string[] = [];
    for (let c = ownCycle(join); c <= ownCycle(today); ) {
      cycles.push(c);
      const [y, mo] = c.split("-").map(Number);
      c = monthKey(y, mo);
    }
    for (let k = 0; k < rnd(6); k++) {
      d.payments.push({ id: "p" + k, driver_id: "d", month: pick(cycles), amount: rnd(50000), mode: "cash", reference: null, paid_on: today, note: null } as never);
    }

    const engine = buildLedger(d, undefined, today);

    let carry = 0;
    for (let ci = 0; ci < cycles.length; ci++) {
      const month = cycles[ci];
      const dates = ownDates(month);
      const n = dates.length;
      // Exact whole-number maths: count "half-days × salary", divide once at the end.
      let basicHalves = 0; // Σ salary × (2 for a paid day, 1 for a half day, 0 for absent)
      let fullUnits = 0; // Σ salary for every day on the job
      for (const date of dates) {
        const employed = date >= join && (!leftOn || date <= leftOn);
        if (!employed) continue;
        const salary = salaryAt(hist, date);
        fullUnits += salary;
        if (date > today) continue;
        const status = marks.get(date) ?? (hols.has(date) ? "holiday" : "present");
        basicHalves += salary * (status === "half" ? 1 : status === "absent" ? 0 : 2);
      }
      const basic = basicHalves / (2 * n);
      const full = fullUnits / n;
      const mine = adj.filter((a) => ownCycle(String(a.date)) === month);
      const sumOf = (kind: string) => Math.round(mine.filter((a) => a.kind === kind).reduce((t, a) => t + Number(a.amount), 0));
      const e = engine[ci];
      monthsChecked++;
      if (!e || e.month !== month) {
        mismatches++;
        if (mismatches <= 3) fails.push(`independent check: month order differs at ${month}`);
        break;
      }

      // the salary earned must be the exact figure rounded to the nearest rupee — nothing else
      const basicOk = e.basicEarned === Math.round(basic) && e.basicEarned >= 0 && e.fullMonth === Math.round(full);
      const earnings = e.basicEarned + sumOf("bonus") + sumOf("allowance") + sumOf("overtime");
      const deduction = sumOf("deduction");
      const applied = Math.min(deduction, earnings);
      const gross = earnings - applied;
      const available = carry + sumOf("advance");
      const recovered = Math.min(available, gross);
      const net = gross - recovered;
      const paid = Math.round(d.payments.filter((p) => p.month === month).reduce((t, p) => t + Number(p.amount), 0));
      const finished = dates[dates.length - 1] < today;
      const overpaid = finished ? Math.max(0, paid - net) : 0;
      const due = Math.max(0, net - paid);
      carry = available - recovered + (deduction - applied) + overpaid;

      const same =
        basicOk &&
        e.gross === gross &&
        e.net === net &&
        e.advanceRecovered === recovered &&
        e.paid === paid &&
        e.due === due &&
        e.overpaid === overpaid &&
        e.net >= 0 &&
        e.due >= 0;
      if (!same) {
        mismatches++;
        if (mismatches <= 3) {
          fails.push(
            "independent check mismatch: " +
              JSON.stringify({ month, join, today, engine: { basic: e.basicEarned, net: e.net, due: e.due, over: e.overpaid }, mine: { basic, net, due, overpaid } }),
          );
        }
        break;
      }
    }
  }
  ok(`independent calculator agrees: ${scenarios} histories, ${monthsChecked} months (${mismatches} mismatches)`, mismatches === 0, mismatches);
  console.log(`independent check: ${scenarios} random driver histories, ${monthsChecked} salary months compared, ${mismatches} differences`);
}

// 20. What the statement shows is exactly the maths: salary ÷ days × days paid
{
  let bad = 0;
  const rnd = (n: number) => Math.floor(Math.random() * n);
  for (let i = 0; i < 5000; i++) {
    const month = `2026-${String(1 + rnd(12)).padStart(2, "0")}-01`;
    const dates = cycleDates(month, PAY_DAY);
    const salary = 5000 + rnd(120000);
    const marks = new Map<string, string>();
    for (let k = 0; k < rnd(dates.length); k++) marks.set(dates[rnd(dates.length)], ["present", "half", "absent", "holiday"][rnd(4)]);
    const m = M(
      data({ salary: [{ monthly_salary: salary, effective_from: "2025-01-01" }], driver: { joining_date: "2025-01-01" }, att: [...marks].map(([date, status]) => ({ date, status })) }),
      month,
      "2030-01-01",
    );
    const daysPaid = m.counts.present + m.counts.holiday + m.counts.half * 0.5;
    // the exact value is salary × days ÷ days-in-period (one division, no drift)
    const shown = Math.round((salary * daysPaid) / dates.length);
    if (m.basicEarned !== shown || m.net < 0) bad++;
  }
  ok(`5,000 months: salary earned = salary ÷ days × days paid (${bad} bad)`, bad === 0, bad);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("\nFAILURES:");
  fails.forEach((f) => console.log(" ✗ " + f));
  process.exit(1);
}
