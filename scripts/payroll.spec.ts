/* Salary engine test suite — run with: npm test */
import { buildLedger, monthFor, salaryOn } from "../src/lib/payroll";
import { daysIn, monthOf, shiftMonth } from "../src/lib/dates";
import type { DriverData, MonthCalc } from "../src/lib/types";

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
}
const data = (o: Over = {}): DriverData =>
  ({
    driver: { id: "d", name: "T", joining_date: "2026-01-01", left_on: null, active: true, overtime_hour_rate: null, ...o.driver },
    salary_history: (o.salary ?? [{ monthly_salary: 30000, effective_from: "2026-01-01" }]).map((s, i) => ({ id: "s" + i, driver_id: "d", ...s })),
    attendance: (o.att ?? []).map((a) => ({ driver_id: "d", note: null, ...a })),
    holidays: (o.hol ?? []).map((h, i) => ({ id: "h" + i, ...h })),
    adjustments: (o.adj ?? []).map((a, i) => ({ id: "a" + i, driver_id: "d", month: monthOf(String(a.date)), unit: null, quantity: null, rate: null, note: null, ...a })),
    payments: (o.pay ?? []).map((p, i) => ({ id: "p" + i, driver_id: "d", mode: "cash", reference: null, note: null, ...p })),
    payroll_months: (o.locked ?? []).map((l) => ({ driver_id: "d", ...l })),
    company: { id: 1, name: "C", address: "", gst_number: "", phone: "", email: "", logo_url: null, pay_day: 5 },
  }) as unknown as DriverData;

const M = (d: DriverData, month: string, today = "2026-12-31") => monthFor(d, month, today);

// ─────────────────────────────────────────────────────────────
// 1. Basic rules
// ─────────────────────────────────────────────────────────────
{
  const d = data({ att: [{ date: "2026-03-05", status: "absent" }, { date: "2026-03-06", status: "half" }] });
  const m = M(d, "2026-03-01"); // 31 days, 30000 → 967.74/day
  eq("Mar absent deduction", m.absentDeduction, Math.round(30000 / 31));
  eq("Mar half deduction", m.halfDeduction, Math.round(30000 / 31 / 2));
  eq("Mar lines add up", m.basicEarned + m.absentDeduction + m.halfDeduction + m.pending, m.fullMonth);
  eq("Mar net", m.net, m.basicEarned);
  eq("counts present", m.counts.present, 29);
  eq("counts half", m.counts.half, 1);
  eq("counts absent", m.counts.absent, 1);
}

// 2. February — normal and leap year
{
  const feb26 = M(data(), "2026-02-01");
  eq("Feb 2026 has 28 days", feb26.daysInMonth, 28);
  eq("Feb 2026 full salary", feb26.net, 30000);
  eq("Feb daily rate", feb26.dailyRate, Math.round(30000 / 28));

  const feb28 = M(data({ att: [{ date: "2028-02-29", status: "absent" }] }), "2028-02-01", "2028-12-31");
  eq("Feb 2028 leap day exists", feb28.daysInMonth, 29);
  eq("Feb 2028 absent on leap day", feb28.counts.absent, 1);
  eq("Feb 2028 net", feb28.net, 30000 - Math.round(30000 / 29));
}

// 3. Company holiday is paid; a driver marked present on a holiday earns the same
{
  const withHol = M(data({ hol: [{ date: "2026-04-14", name: "Ambedkar Jayanti" }] }), "2026-04-01");
  eq("holiday counted", withHol.counts.holiday, 1);
  eq("holiday paid in full", withHol.net, 30000);

  const worked = M(
    data({ hol: [{ date: "2026-04-14", name: "X" }], att: [{ date: "2026-04-14", status: "present" }] }),
    "2026-04-01",
  );
  eq("present overrides holiday", worked.counts.present, 30);
  eq("same pay either way", worked.net, withHol.net);

  const absentOnHoliday = M(
    data({ hol: [{ date: "2026-04-14", name: "X" }], att: [{ date: "2026-04-14", status: "absent" }] }),
    "2026-04-01",
  );
  eq("absent on a holiday is unpaid", absentOnHoliday.net, 30000 - Math.round(30000 / 30));
}

// 4. Salary change mid-month is day-wise
{
  const d = data({ salary: [{ monthly_salary: 20000, effective_from: "2026-01-01" }, { monthly_salary: 26000, effective_from: "2026-05-11" }] });
  const m = M(d, "2026-05-01"); // 31 days: 10 days @20000, 21 days @26000
  const expected = Math.round((10 * 20000) / 31 + (21 * 26000) / 31);
  eq("mid-month salary change", m.basicEarned, expected);
  ok("salaryChanged flag", m.salaryChanged === true, m.salaryChanged);
  eq("monthlySalary shows the latest", m.monthlySalary, 26000);
  eq("salaryOn before change", salaryOn(d.salary_history, "2026-05-10"), 20000);
  eq("salaryOn on change day", salaryOn(d.salary_history, "2026-05-11"), 26000);

  // effective date before joining / earliest record still resolves
  eq("salaryOn before first record falls back", salaryOn(d.salary_history, "2025-06-01"), 20000);
}

// 5. Joining and leaving mid-month
{
  const joined = M(data({ driver: { joining_date: "2026-06-16" } }), "2026-06-01");
  eq("joined 16 Jun → 15 of 30 days", joined.net, Math.round((15 * 30000) / 30));
  eq("days before joining not counted", joined.counts.employed, 15);

  const left = M(data({ driver: { left_on: "2026-06-10", active: false } }), "2026-06-01");
  eq("left 10 Jun → 10 days", left.net, Math.round((10 * 30000) / 30));
  eq("month after leaving is zero", M(data({ driver: { left_on: "2026-06-10" } }), "2026-07-01").net, 0);

  const both = M(data({ driver: { joining_date: "2026-06-05", left_on: "2026-06-20" } }), "2026-06-01");
  eq("joined and left same month = 16 days", both.counts.employed, 16);
  eq("joined and left pay", both.net, Math.round((16 * 30000) / 30));
}

// 6. Live salary (current month counts only up to today)
{
  const today = "2026-09-10";
  const m = M(data(), "2026-09-01", today);
  eq("live basic to 10 Sept", m.basicEarned, Math.round((10 * 30000) / 30));
  eq("pending rest of month", m.pending, Math.round((20 * 30000) / 30));
  eq("upcoming count", m.counts.upcoming, 20);
  ok("month not complete", m.complete === false, m.complete);

  // planned future leave must not change today's earnings
  const planned = M(data({ att: [{ date: "2026-09-25", status: "absent" }] }), "2026-09-01", today);
  eq("future absence does not reduce live pay", planned.basicEarned, m.basicEarned);
  eq("future absence not counted yet", planned.counts.absent, 0);
}

// 7. Advances: chaining, partial recovery, carry-forward
{
  const d = data({ adj: [{ date: "2026-01-05", kind: "advance", amount: 70000 }] });
  const ledger = buildLedger(d, undefined, "2026-12-31");
  const jan = ledger.find((m) => m.month === "2026-01-01")!;
  const feb = ledger.find((m) => m.month === "2026-02-01")!;
  const mar = ledger.find((m) => m.month === "2026-03-01")!;
  eq("Jan recovers all pay", jan.advanceRecovered, 30000);
  eq("Jan net 0", jan.net, 0);
  eq("Jan carry", jan.advanceClosing, 40000);
  eq("Feb opening", feb.advanceOpening, 40000);
  eq("Feb net 0", feb.net, 0);
  eq("Feb carry", feb.advanceClosing, 10000);
  eq("Mar recovers remaining", mar.advanceRecovered, 10000);
  eq("Mar net", mar.net, 20000);
  eq("Mar carry cleared", mar.advanceClosing, 0);
}

// 8. Deductions bigger than earnings: pay stops at zero and the rest carries forward
{
  const d = data({ adj: [{ date: "2026-03-10", kind: "deduction", amount: 50000 }] });
  const m = M(d, "2026-03-01");
  eq("net never negative", m.net, 0);
  eq("gross never negative", m.gross, 0);
  eq("only what could be taken is taken", m.deductionApplied, 30000);
  eq("the rest is carried", m.deductionCarried, 20000);
  eq("carried into next month's balance", m.advanceClosing, 20000);
  const apr = buildLedger(d, undefined, "2026-12-31").find((x) => x.month === "2026-04-01")!;
  eq("April opens with the carried deduction", apr.advanceOpening, 20000);
  eq("April recovers it", apr.net, 10000);
}

// 8b. "Full month pay" always equals the real monthly salary (no rounding drift)
{
  for (const [month, salary] of [["2026-02-01", 10000], ["2026-03-01", 33333], ["2026-04-01", 17777], ["2026-02-01", 21000]] as const) {
    const d = data({
      salary: [{ monthly_salary: salary, effective_from: "2026-01-01" }],
      att: [
        { date: month.slice(0, 8) + "05", status: "absent" },
        { date: month.slice(0, 8) + "06", status: "absent" },
        { date: month.slice(0, 8) + "07", status: "half" },
        { date: month.slice(0, 8) + "08", status: "half" },
      ],
    });
    const m = M(d, month);
    eq(`full month pay = salary (${month} @${salary})`, m.fullMonth, salary);
    eq("and the lines still add up", m.basicEarned + m.absentDeduction + m.halfDeduction + m.pending, m.fullMonth);
  }
}

// 8c. A driver whose joining date is in the future does not break anything
{
  const d = data({ driver: { joining_date: "2027-05-10" } });
  const l = buildLedger(d, undefined, "2026-09-23");
  ok("ledger is never empty", l.length >= 1, l.length);
  eq("future joiner earns nothing yet", l[0].net, 0);
  ok("no NaN for a future joiner", Number.isFinite(l[0].fullMonth), l[0].fullMonth);
}

// 9. Extras add up; overtime included
{
  const m = M(
    data({
      adj: [
        { date: "2026-03-02", kind: "bonus", amount: 2000 },
        { date: "2026-03-03", kind: "allowance", amount: 1500 },
        { date: "2026-03-04", kind: "overtime", amount: 900, unit: "hour", quantity: 6, rate: 150 },
        { date: "2026-03-05", kind: "deduction", amount: 400 },
      ],
    }),
    "2026-03-01",
  );
  eq("bonus", m.bonus, 2000);
  eq("allowance", m.allowance, 1500);
  eq("overtime", m.overtime, 900);
  eq("deduction", m.otherDeduction, 400);
  eq("gross", m.gross, 30000 + 2000 + 1500 + 900 - 400);
  eq("net equals gross when no advance", m.net, m.gross);
}

// 10. Payments and status
{
  const base = { date: "2026-03-01" };
  const unpaid = M(data(), "2026-03-01");
  eq("unpaid status", unpaid.payStatus, "unpaid");
  eq("due equals net", unpaid.due, 30000);

  const partial = M(data({ pay: [{ month: "2026-03-01", amount: 10000, paid_on: "2026-04-05" }] }), "2026-03-01");
  eq("partial status", partial.payStatus, "partial");
  eq("partial due", partial.due, 20000);

  const paid = M(data({ pay: [{ month: "2026-03-01", amount: 20000, paid_on: "2026-04-05" }, { month: "2026-03-01", amount: 10000, paid_on: "2026-04-07" }] }), "2026-03-01");
  eq("split payments = paid", paid.payStatus, "paid");
  eq("no balance", paid.due, 0);

  const over = M(data({ pay: [{ month: "2026-03-01", amount: 45000, paid_on: "2026-04-05" }] }), "2026-03-01");
  eq("overpaid never negative due", over.due, 0);
  void base;
}

// 11. Due date follows the company pay day
{
  const d = data();
  d.company.pay_day = 7;
  eq("due date 7th of next month", M(d, "2026-03-01").dueDate, "2026-04-07");
  eq("December rolls into January", M(d, "2026-12-01").dueDate, "2027-01-07");
}

// 12. Locked month is frozen
{
  const snapshotMonth = M(data({ att: [{ date: "2026-03-05", status: "absent" }] }), "2026-03-01");
  const afterChange = data({
    salary: [{ monthly_salary: 30000, effective_from: "2026-01-01" }, { monthly_salary: 90000, effective_from: "2026-03-01" }],
    att: [{ date: "2026-03-05", status: "absent" }, { date: "2026-03-06", status: "absent" }],
    locked: [{ month: "2026-03-01", snapshot: snapshotMonth }],
  });
  const m = M(afterChange, "2026-03-01");
  eq("locked month keeps frozen net", m.net, snapshotMonth.net);
  ok("locked flag", m.locked === true, m.locked);

  // payments made after locking still show up
  const withPay = data({
    locked: [{ month: "2026-03-01", snapshot: snapshotMonth }],
    pay: [{ month: "2026-03-01", amount: 5000, paid_on: "2026-04-05" }],
  });
  const lp = M(withPay, "2026-03-01");
  eq("locked month tracks payments", lp.paid, 5000);
  eq("locked month due", lp.due, snapshotMonth.net - 5000);
}

// 13. Locked month still feeds the advance chain
{
  const janData = data({ adj: [{ date: "2026-01-05", kind: "advance", amount: 50000 }] });
  const jan = buildLedger(janData, undefined, "2026-12-31").find((m) => m.month === "2026-01-01")!;
  const locked = data({
    adj: [{ date: "2026-01-05", kind: "advance", amount: 50000 }],
    locked: [{ month: "2026-01-01", snapshot: jan }],
  });
  const feb = buildLedger(locked, undefined, "2026-12-31").find((m) => m.month === "2026-02-01")!;
  eq("carry survives a locked month", feb.advanceOpening, 20000);

  // an advance added later to an earlier, unlocked month must not vanish
  const janLocked = data({
    adj: [{ date: "2026-01-05", kind: "advance", amount: 50000 }],
    locked: [{ month: "2026-02-01", snapshot: M(data(), "2026-02-01") }],
  });
  const mar = buildLedger(janLocked, undefined, "2026-12-31").find((m) => m.month === "2026-03-01")!;
  ok("a later change to an earlier month is still recovered", mar.advanceOpening > 0, mar.advanceOpening);
}

// 14. Notes / marked-present rows do not change money
{
  const m = M(data({ att: [{ date: "2026-03-12", status: "present", note: "Extra trip" }] }), "2026-03-01");
  eq("note does not change pay", m.net, 30000);
  eq("still counted present", m.counts.present, 31);
}

// 15. Zero salary and no salary history
{
  const zero = M(data({ salary: [{ monthly_salary: 0, effective_from: "2026-01-01" }] }), "2026-03-01");
  eq("zero salary → zero pay", zero.net, 0);
  ok("no NaN", Number.isFinite(zero.net) && Number.isFinite(zero.dailyRate), zero);

  const none = data();
  none.salary_history = [];
  const m = M(none, "2026-03-01");
  eq("missing salary history → 0", m.net, 0);
  ok("no NaN without history", Number.isFinite(m.fullMonth), m.fullMonth);
}

// 16. Ledger covers every month from joining to now, in order
{
  const l = buildLedger(data({ driver: { joining_date: "2026-01-20" } }), undefined, "2026-06-15");
  eq("ledger length Jan..Jun", l.length, 6);
  eq("first month", l[0].month, "2026-01-01");
  eq("last month", l[l.length - 1].month, "2026-06-01");
  ok("months ascending", l.every((m, i) => i === 0 || m.month > l[i - 1].month), l.map((m) => m.month));
}

// 17. Salary history order does not matter
{
  const inOrder = data({ salary: [{ monthly_salary: 20000, effective_from: "2026-01-01" }, { monthly_salary: 25000, effective_from: "2026-03-15" }] });
  const reversed = data({ salary: [{ monthly_salary: 25000, effective_from: "2026-03-15" }, { monthly_salary: 20000, effective_from: "2026-01-01" }] });
  eq("unsorted history gives same result", M(reversed, "2026-03-01").basicEarned, M(inOrder, "2026-03-01").basicEarned);
}

// ─────────────────────────────────────────────────────────────
// 18. Property tests: 2000 random months must always balance
// ─────────────────────────────────────────────────────────────
{
  let bad = 0;
  const rnd = (n: number) => Math.floor(Math.random() * n);
  for (let i = 0; i < 2000; i++) {
    const month = `2026-${String(1 + rnd(12)).padStart(2, "0")}-01`;
    const n = daysIn(month);
    const salary = 5000 + rnd(120000);
    const att = Array.from({ length: rnd(10) }, () => ({
      date: `${month.slice(0, 8)}${String(1 + rnd(n)).padStart(2, "0")}`,
      status: ["present", "half", "absent", "holiday"][rnd(4)],
    }));
    const uniq = new Map(att.map((a) => [a.date, a]));
    const d = data({
      salary: [{ monthly_salary: salary, effective_from: "2026-01-01" }],
      att: [...uniq.values()],
      adj: [
        ...(rnd(2) ? [{ date: `${month.slice(0, 8)}05`, kind: "bonus", amount: rnd(5000) }] : []),
        ...(rnd(2) ? [{ date: `${month.slice(0, 8)}06`, kind: "advance", amount: rnd(60000) }] : []),
        ...(rnd(3) === 0 ? [{ date: `${month.slice(0, 8)}07`, kind: "deduction", amount: rnd(3000) }] : []),
      ],
    });
    const m = M(d, month);

    const linesAddUp = m.basicEarned + m.absentDeduction + m.halfDeduction + m.pending === m.fullMonth;
    const grossOk =
      m.gross === m.basicEarned + m.bonus + m.allowance + m.overtime - m.deductionApplied &&
      m.gross >= 0 &&
      m.deductionApplied + m.deductionCarried === m.otherDeduction;
    const netOk = m.net === Math.max(0, m.gross - m.advanceRecovered);
    const advanceOk =
      m.advanceClosing === m.advanceOpening + m.advanceGiven - m.advanceRecovered + m.deductionCarried && m.advanceClosing >= 0;
    const ints = [m.fullMonth, m.basicEarned, m.net, m.gross, m.advanceRecovered, m.paid, m.due].every(Number.isInteger);
    // salary slip identity: earnings − deductions = net
    const totalEarnings = m.fullMonth + m.bonus + m.allowance + m.overtime;
    const printedDeductions = m.absentDeduction + m.halfDeduction + m.pending + m.deductionApplied + m.advanceRecovered;
    const slipOk = totalEarnings - printedDeductions === m.net;
    // basic earned can never exceed the full month or go below zero
    const rangeOk = m.basicEarned >= 0 && m.basicEarned <= m.fullMonth && m.net >= 0;

    if (!(linesAddUp && grossOk && netOk && advanceOk && ints && slipOk && rangeOk)) {
      bad++;
      if (bad <= 3) fails.push(`property fail: ${JSON.stringify({ month, salary, m: { ...m, days: undefined } })}`);
    }
  }
  ok(`2000 random months balance (${bad} bad)`, bad === 0, bad);
}

// 19. Multi-month advance + salary change + locking, all together
{
  const d = data({
    driver: { joining_date: "2026-01-10" },
    salary: [{ monthly_salary: 24000, effective_from: "2026-01-10" }, { monthly_salary: 30000, effective_from: "2026-03-01" }],
    att: [
      { date: "2026-01-15", status: "absent" },
      { date: "2026-02-10", status: "half" },
      { date: "2026-03-20", status: "absent" },
    ],
    hol: [{ date: "2026-01-26", name: "Republic Day" }],
    adj: [{ date: "2026-02-02", kind: "advance", amount: 40000 }],
    pay: [{ month: "2026-01-01", amount: 16000, paid_on: "2026-02-05" }],
  });
  const l = buildLedger(d, undefined, "2026-04-30");
  const [jan, feb, mar] = l;
  const janExpect = Math.round((22 * 24000) / 31) - Math.round(24000 / 31); // 10th..31st = 22 days, minus 1 absent
  eq("Jan basic (joined 10th, 1 absent, holiday paid)", jan.basicEarned, janExpect);
  eq("Feb: advance eats the pay", feb.net, 0);
  eq("Feb carry", feb.advanceClosing, 40000 - feb.gross);
  eq("Mar uses new salary", mar.monthlySalary, 30000);
  eq("Mar absent deduction at new rate", mar.absentDeduction, Math.round(30000 / 31));
  eq("Jan partly paid", jan.payStatus, "partial");
  eq("chain: Mar opening = Feb closing", mar.advanceOpening, feb.advanceClosing);
}

// 20. monthFor for a month with no data returns a clean full-pay month
{
  const m = M(data(), "2026-11-01");
  eq("empty month = full pay", m.net, 30000);
  eq("every day present by default", m.counts.present, 30);
  eq("shiftMonth sanity", shiftMonth("2026-12-01", 1), "2027-01-01");
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("\nFAILURES:");
  fails.forEach((f) => console.log(" ✗ " + f));
  process.exit(1);
}
