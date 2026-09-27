/**
 * Printable A4 documents (English). Rendered off-screen and saved as PDF by usePdfExport().
 * Colors come from the same tokens as the app.
 */
import type { ReactNode } from "react";
import { cycleEnd, cycleOf, cycleStart, DEFAULT_PAY_DAY, firstWeekday, fmtDate, fmtMonth, todayISO } from "@/lib/dates";
import { cn, inr } from "@/lib/utils";
import type { Adjustment, DayStatus, DriverData, MonthCalc } from "@/lib/types";
import { STATUS_STYLES } from "./ui";

const STATUS_LABEL: Record<DayStatus, string> = { present: "Present", half: "Half day", absent: "Absent", holiday: "Holiday" };
const MODE_LABEL: Record<string, string> = { cash: "Cash", upi: "UPI", bank: "Bank transfer", cheque: "Cheque" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DocHeader({ data, title, month, period }: { data: DriverData; title: string; month: string; period?: string }) {
  const c = data.company;
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-brand px-10 pb-6 pt-8">
      <div className="flex items-center gap-4">
        <img src={c.logo_url || "/logo.png"} crossOrigin="anonymous" alt="" className="size-16 object-contain" />
        <div>
          <div className="font-display text-2xl font-bold text-foreground">{c.name}</div>
          {c.address && <div className="mt-0.5 max-w-sm whitespace-pre-line text-[12px] leading-snug text-muted-foreground">{c.address}</div>}
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {[c.gst_number && `GSTIN: ${c.gst_number}`, c.phone, c.email].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">{title}</div>
        <div className="mt-1 font-display text-xl font-bold text-foreground">{fmtMonth(month)}</div>
        {period && <div className="text-[12px] text-muted-foreground">{period}</div>}
      </div>
    </div>
  );
}

function InfoGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div>
          <div className="mt-0.5 text-[13px] font-semibold">{v || "—"}</div>
        </div>
      ))}
    </div>
  );
}

/** First and last day the driver was actually employed inside this month. */
function payPeriod(calc: MonthCalc) {
  const employed = calc.days.filter((d) => d.employed);
  const from = employed[0] ?? calc.days[0];
  const to = employed[employed.length - 1] ?? calc.days[calc.days.length - 1];
  return `${fmtDate(from.date)} – ${fmtDate(to.date)}`;
}

function DriverBlock({ data, calc }: { data: DriverData; calc: MonthCalc }) {
  const d = data.driver;
  return (
    <div className="flex gap-6 border-b px-10 py-6">
      {d.photo_url && <img src={d.photo_url} crossOrigin="anonymous" alt="" className="size-20 rounded-xl object-cover" />}
      <div className="flex-1">
        <InfoGrid
          items={[
            ["Driver name", d.name],
            ["Truck number", d.truck_number],
            ["Phone", d.phone],
            ["Bank / UPI", d.bank_account ? `A/c ${d.bank_account}` : d.upi_id],
            ["Joining date", fmtDate(d.joining_date)],
            ["Pay period", payPeriod(calc)],
          ]}
        />
      </div>
    </div>
  );
}

function Counts({ calc }: { calc: MonthCalc }) {
  const paidDays = calc.counts.present + calc.counts.holiday + calc.counts.half * 0.5;
  const cells: [string, number | string, string][] = [
    ["Days in month", calc.daysInMonth, "bg-muted"],
    ["Present", calc.counts.present, STATUS_STYLES.present.soft],
    ["Half day", calc.counts.half, STATUS_STYLES.half.soft],
    ["Absent", calc.counts.absent, STATUS_STYLES.absent.soft],
    ["Holiday", calc.counts.holiday, STATUS_STYLES.holiday.soft],
    ["Paid days", paidDays, "bg-ink text-ink-foreground"],
  ];
  return (
    <div className="grid grid-cols-6 gap-2">
      {cells.map(([k, v, cls]) => (
        <div key={k} className={cn("rounded-lg px-2 py-3 text-center", cls)}>
          <div className="font-display text-xl font-bold tabular">{v}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide opacity-75">{k}</div>
        </div>
      ))}
    </div>
  );
}


// Indian number to words (for "Rupees ... only")
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function two(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}
function three(n: number) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
}
export function inWords(n: number) {
  n = Math.round(n);
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}


function extraLabel(a: Adjustment) {
  const base = { bonus: "Bonus", allowance: "Allowance", overtime: "Overtime", deduction: "Deduction", advance: "Advance" }[a.kind];
  const qty = a.kind === "overtime" && a.quantity ? ` (${a.quantity} ${a.unit === "hour" ? "hrs" : "days"} × ${inr(a.rate ?? 0)})` : "";
  return `${base}${qty}${a.note ? ` – ${a.note}` : ""}`;
}

function Footer() {
  return (
    <div className="mt-auto flex items-end justify-between px-10 pb-8 pt-10 text-[11px] text-muted-foreground">
      <div>
        Generated on {fmtDate(todayISO())}. This is a computer-generated document.
        <div className="mt-1">Designed &amp; developed by Kavion Solutions · kavionsolutions.in</div>
      </div>
      <div className="text-center">
        <div className="mb-1 h-10 w-44 border-b border-foreground/40" />
        Authorised signatory
      </div>
    </div>
  );
}

// ── Salary statement — white, step by step, easy for a driver to follow ──
const paise = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 29.5 → "29½ days", 0.5 → "½ day", 1 → "1 day" */
const dayWord = (n: number) => {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  const shown = half ? (whole ? `${whole}½` : "½") : String(whole);
  return `${shown} day${n === 1 || n === 0.5 ? "" : "s"}`;
};

export function SalaryStatement({ data, calc, payDay = DEFAULT_PAY_DAY }: { data: DriverData; calc: MonthCalc; payDay?: number }) {
  const cycle = (date: string) => cycleOf(date, data.company?.pay_day ?? payDay);
  const adj = data.adjustments.filter((a) => cycle(a.date) === calc.month).sort((a, b) => a.date.localeCompare(b.date));
  const payments = data.payments.filter((p) => p.month === calc.month).sort((a, b) => a.paid_on.localeCompare(b.paid_on));
  const d = data.driver;

  const from = cycleStart(calc.month, payDay);
  const to = cycleEnd(calc.month, payDay);
  const running = !calc.complete && !calc.locked;
  const n = calc.daysInMonth;

  // the days that are paid, and the days that are not
  const daysPaid = calc.counts.present + calc.counts.holiday + calc.counts.half * 0.5;
  const onJob = calc.counts.employed;
  const notOnJob = n - onJob;
  const perDay = calc.monthlySalary / n;

  const extrasPlus = adj.filter((a) => a.kind === "bonus" || a.kind === "allowance" || a.kind === "overtime");
  const extrasMinus = adj.filter((a) => a.kind === "deduction");
  const advances = adj.filter((a) => a.kind === "advance");

  const balance = calc.due;
  const fullyPaid = balance === 0 && calc.net > 0;

  const Step = ({ no, text, sub, amount, strong }: { no?: number | string; text: string; sub?: string; amount: string; strong?: boolean }) => (
    <tr className={cn("border-b border-border/70", strong && "bg-muted/50")}>
      <td className="w-9 py-3 pl-1 align-top text-[12px] font-bold text-muted-foreground">{no ?? ""}</td>
      <td className="py-3 pr-4 align-top">
        <div className={cn("text-[13px]", strong ? "font-bold" : "font-medium")}>{text}</div>
        {sub && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>}
      </td>
      <td className={cn("py-3 pr-1 text-right align-top tabular text-[13px]", strong ? "font-bold" : "font-semibold")}>{amount}</td>
    </tr>
  );

  // how many days are being paid, in words a driver understands
  const daysExplained = [
    notOnJob > 0 && d.joining_date > from ? `joined on ${fmtDate(d.joining_date)}` : "",
    notOnJob > 0 && d.left_on && d.left_on < to ? `left on ${fmtDate(d.left_on)}` : "",
    calc.counts.absent ? `${dayWord(calc.counts.absent)} leave` : "",
    calc.counts.half ? `${dayWord(calc.counts.half * 0.5)} for ${calc.counts.half} half day${calc.counts.half === 1 ? "" : "s"}` : "",
    running && calc.counts.upcoming ? `${dayWord(calc.counts.upcoming)} still to come` : "",
  ].filter(Boolean);

  let step = 0;
  return (
    <div className="flex min-h-[1123px] flex-col bg-white font-sans text-foreground">
      <DocHeader data={data} title="Salary statement" month={calc.month} period={`${fmtDate(from)} – ${fmtDate(to)}`} />

      {/* Driver */}
      <div className="mx-10 mt-6 grid grid-cols-4 gap-x-6 gap-y-3 rounded-xl border bg-muted/40 px-6 py-4">
        {[
          ["Driver", d.name],
          ["Truck", d.truck_number],
          ["Phone", d.phone],
          ["Joined", fmtDate(d.joining_date)],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-[13px] font-semibold">{v || "—"}</div>
          </div>
        ))}
      </div>

      <div className="px-10 pt-6">
        <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">How your salary is worked out</h2>
        <table className="w-full border-collapse">
          <tbody>
            <Step no={++step} text="Monthly salary" amount={inr(calc.monthlySalary)} />
            <Step no={++step} text={`Days in this salary month (${fmtDate(from)} – ${fmtDate(to)})`} amount={`${n} days`} />
            {calc.salaryChanged ? (
              <Step no={++step} text="Pay for one day" sub="Your salary changed during this month, so each day is paid at the salary on that day." amount="—" />
            ) : (
              <Step no={++step} text="Pay for one day" sub={`${inr(calc.monthlySalary)} ÷ ${n} days`} amount={paise(perDay)} />
            )}
            <Step
              no={++step}
              text={running ? "Days worked so far" : "Days to be paid"}
              sub={daysExplained.length ? `${n} days − ${daysExplained.join(" − ")}` : `All ${n} days`}
              amount={dayWord(daysPaid)}
            />
            <Step
              no={++step}
              text={running ? "Salary earned so far" : "Salary earned"}
              sub={calc.salaryChanged ? undefined : `${dayWord(daysPaid)} × ${paise(perDay)}`}
              amount={inr(calc.basicEarned)}
              strong
            />
          </tbody>
        </table>

        {(extrasPlus.length > 0 || extrasMinus.length > 0 || calc.advanceRecovered > 0) && (
          <>
            <h2 className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Extra money and deductions</h2>
            <table className="w-full border-collapse">
              <tbody>
                {extrasPlus.map((a) => (
                  <Step key={a.id} text={extraLabel(a)} sub={fmtDate(a.date)} amount={`+ ${inr(Math.round(Number(a.amount)))}`} />
                ))}
                {calc.deductionApplied > 0 && (
                  <Step
                    text={extrasMinus.length === 1 ? extraLabel(extrasMinus[0]) : "Deductions"}
                    sub={calc.deductionCarried > 0 ? `${inr(calc.deductionCarried)} more will be taken next month (pay never goes below zero)` : undefined}
                    amount={`− ${inr(calc.deductionApplied)}`}
                  />
                )}
                {calc.advanceRecovered > 0 && (
                  <Step
                    text="Advance taken back"
                    sub={advances.length ? `Cash advance given on ${advances.map((a) => fmtDate(a.date)).join(", ")}` : "Advance from earlier months"}
                    amount={`− ${inr(calc.advanceRecovered)}`}
                  />
                )}
              </tbody>
            </table>
          </>
        )}

        <table className="mt-4 w-full border-collapse">
          <tbody>
            <Step text={running ? "Total salary so far" : "Total salary for this month"} amount={inr(calc.net)} strong />
          </tbody>
        </table>

        {payments.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Already paid</h2>
            <table className="w-full border-collapse">
              <tbody>
                {payments.map((p) => (
                  <Step
                    key={p.id}
                    text={`Paid by ${MODE_LABEL[p.mode]}`}
                    sub={[fmtDate(p.paid_on), p.reference].filter(Boolean).join(" · ")}
                    amount={`− ${inr(Math.round(Number(p.amount)))}`}
                  />
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Result — never negative */}
        <div
          className={cn(
            "mt-6 flex items-center justify-between rounded-xl border-2 px-6 py-4",
            fullyPaid ? "border-present bg-present-soft" : "border-brand/40 bg-brand/5",
          )}
        >
          <div>
            <div className={cn("text-[12px] font-bold uppercase tracking-wider", fullyPaid ? "text-present-ink" : "text-brand")}>
              {fullyPaid ? "Fully paid" : running ? "Amount so far" : "Amount to pay"}
            </div>
            <div className="text-[12px] text-muted-foreground">Rupees {inWords(balance)} only</div>
          </div>
          <div className="font-display text-3xl font-bold tabular">{inr(balance)}</div>
        </div>

        <div className="mt-3 space-y-1 text-[11.5px] text-muted-foreground">
          {calc.overpaid > 0 && <p>You were paid {inr(calc.overpaid)} more than this month's salary. It will be taken from next month's salary.</p>}
          {calc.advanceClosing > 0 && <p>Advance still to be taken back next month: {inr(calc.advanceClosing)}</p>}
          {running && <p>This month is still running. The final amount is known after {fmtDate(to)}. Salary is paid on {fmtDate(calc.dueDate)}.</p>}
          {!running && <p>Salary is paid on {fmtDate(calc.dueDate)}.</p>}
        </div>
      </div>
      <Footer />
    </div>
  );
}

/** Old name kept so existing imports keep working. */
export const SalarySlip = SalaryStatement;

// ── Attendance report ───────────────────────────────────────
export function AttendanceReport({ data, calc }: { data: DriverData; calc: MonthCalc }) {
  const blanks = firstWeekday(calc.days[0]?.date ?? calc.month);
  const special = calc.days.filter((d) => d.employed && (d.source !== "default" || d.note));
  return (
    <div className="flex min-h-[1123px] flex-col bg-white font-sans text-foreground">
      <DocHeader data={data} title="Attendance report" month={calc.month} period={`${fmtDate(calc.days[0]?.date ?? calc.month)} – ${fmtDate(calc.days[calc.days.length - 1]?.date ?? calc.month)}`} />
      <DriverBlock data={data} calc={calc} />
      <div className="space-y-6 px-10 py-6">
        <Counts calc={calc} />
        <div>
          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: blanks }, (_, i) => (
              <div key={i} />
            ))}
            {calc.days.map((d) => (
              <div
                key={d.date}
                className={cn(
                  "flex h-[62px] flex-col justify-between rounded-lg p-2",
                  !d.employed ? "bg-muted/40 text-muted-foreground/50" : d.future ? "border border-dashed text-muted-foreground" : STATUS_STYLES[d.status].soft,
                )}
              >
                <span className="font-display text-[15px] font-bold tabular">{d.day}</span>
                <span className="text-[10px] font-bold uppercase leading-none">
                  {!d.employed ? "" : d.future ? "—" : d.status === "present" ? "P" : STATUS_LABEL[d.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
        {special.length > 0 && (
          <div className="overflow-hidden rounded-xl border">
            <div className="bg-muted px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Remarks</div>
            <div className="divide-y text-[12px]">
              {special.map((d) => (
                <div key={d.date} className="flex gap-4 px-4 py-1.5">
                  <span className="w-24 tabular">{fmtDate(d.date)}</span>
                  <span className="w-20 font-semibold">{STATUS_LABEL[d.status]}</span>
                  <span className="text-muted-foreground">{d.holidayName ?? d.note ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
