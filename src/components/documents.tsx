/**
 * Printable A4 documents (English). Rendered off-screen and saved as PDF by usePdfExport().
 * Colors come from the same tokens as the app.
 */
import type { ReactNode } from "react";
import { fmtDate, fmtMonth, todayISO } from "@/lib/dates";
import { cn, inr } from "@/lib/utils";
import type { Adjustment, DayStatus, DriverData, MonthCalc } from "@/lib/types";
import { STATUS_STYLES } from "./ui";

const STATUS_LABEL: Record<DayStatus, string> = { present: "Present", half: "Half day", absent: "Absent", holiday: "Holiday" };
const MODE_LABEL: Record<string, string> = { cash: "Cash", upi: "UPI", bank: "Bank transfer", cheque: "Cheque" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DocHeader({ data, title, month }: { data: DriverData; title: string; month: string }) {
  const c = data.company;
  return (
    <div className="flex items-start justify-between gap-6 bg-ink px-10 py-8 text-ink-foreground">
      <div className="flex items-center gap-4">
        <img src={c.logo_url || "/logo.png"} crossOrigin="anonymous" alt="" className="size-16 rounded-lg bg-white object-contain" />
        <div>
          <div className="font-display text-2xl font-bold">{c.name}</div>
          {c.address && <div className="mt-1 max-w-sm whitespace-pre-line text-[12px] leading-snug opacity-80">{c.address}</div>}
          <div className="mt-1 text-[12px] opacity-80">
            {[c.gst_number && `GSTIN: ${c.gst_number}`, c.phone, c.email].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">{title}</div>
        <div className="mt-1 font-display text-xl font-bold">{fmtMonth(month)}</div>
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

function DriverBlock({ data, calc }: { data: DriverData; calc: MonthCalc }) {
  const d = data.driver;
  return (
    <div className="flex gap-6 border-b px-10 py-6">
      {d.photo_url && <img src={d.photo_url} crossOrigin="anonymous" alt="" className="size-20 rounded-xl object-cover" />}
      <div className="flex-1">
        <InfoGrid
          items={[
            ["Driver name", d.name],
            ["Driver ID", d.login_code],
            ["Truck number", d.truck_number],
            ["Phone", d.phone],
            ["Joining date", fmtDate(d.joining_date)],
            ["Pay period", `${fmtDate(calc.days[0].date)} – ${fmtDate(calc.days[calc.days.length - 1].date)}`],
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

function Table({ title, rows, total }: { title: string; rows: [string, number][]; total: [string, number] }) {
  return (
    <div className="flex-1 overflow-hidden rounded-xl border">
      <div className="bg-muted px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="divide-y px-4">
        {rows.length === 0 && <div className="py-2 text-[13px] text-muted-foreground">—</div>}
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-2 text-[13px]">
            <span>{k}</span>
            <span className="tabular font-semibold">{inr(v)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t bg-muted/60 px-4 py-2.5 text-[13px] font-bold">
        <span>{total[0]}</span>
        <span className="tabular">{inr(total[1])}</span>
      </div>
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
      </div>
      <div className="text-center">
        <div className="mb-1 h-10 w-44 border-b border-foreground/40" />
        Authorised signatory
      </div>
    </div>
  );
}

// ── Salary slip ─────────────────────────────────────────────
export function SalarySlip({ data, calc }: { data: DriverData; calc: MonthCalc }) {
  const adj = data.adjustments.filter((a) => a.month === calc.month);
  const payments = data.payments.filter((p) => p.month === calc.month).sort((a, b) => a.paid_on.localeCompare(b.paid_on));

  const earnings: [string, number][] = [["Basic salary (full month)", calc.fullMonth]];
  adj.filter((a) => ["bonus", "allowance", "overtime"].includes(a.kind)).forEach((a) => earnings.push([extraLabel(a), Math.round(Number(a.amount))]));
  const totalEarnings = calc.fullMonth + calc.bonus + calc.allowance + calc.overtime;

  const deductions: [string, number][] = [];
  if (calc.absentDeduction) deductions.push([`Absent (${calc.counts.absent} day${calc.counts.absent === 1 ? "" : "s"})`, calc.absentDeduction]);
  if (calc.halfDeduction) deductions.push([`Half days (${calc.counts.half})`, calc.halfDeduction]);
  if (calc.pending) deductions.push([`Days not yet worked (${calc.counts.upcoming})`, calc.pending]);
  adj.filter((a) => a.kind === "deduction").forEach((a) => deductions.push([extraLabel(a), Math.round(Number(a.amount))]));
  if (calc.advanceRecovered) deductions.push(["Advance recovered", calc.advanceRecovered]);
  const totalDeductions = totalEarnings - calc.net;

  return (
    <div className="flex min-h-[1123px] flex-col bg-white font-sans text-foreground">
      <DocHeader data={data} title="Salary slip" month={calc.month} />
      <DriverBlock data={data} calc={calc} />
      <div className="space-y-5 px-10 py-6">
        <Counts calc={calc} />
        <div className="text-[12px] text-muted-foreground">
          Monthly salary {inr(calc.monthlySalary)} · {calc.daysInMonth} days · {inr(calc.dailyRate)} per day
          {calc.salaryChanged && " · salary revised during this month (calculated day-wise)"}
        </div>
        <div className="flex gap-4">
          <Table title="Earnings" rows={earnings} total={["Total earnings", totalEarnings]} />
          <Table title="Deductions" rows={deductions} total={["Total deductions", totalDeductions]} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-brand px-6 py-4 text-brand-foreground">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Net pay</div>
            <div className="text-[12px] opacity-90">Rupees {inWords(calc.net)} only</div>
          </div>
          <div className="font-display text-3xl font-bold tabular">{inr(calc.net)}</div>
        </div>

        <div className="flex gap-4">
          <div className="flex-[1.4] overflow-hidden rounded-xl border">
            <div className="bg-muted px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payment details</div>
            {payments.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-muted-foreground">Not paid yet · due on {fmtDate(calc.dueDate)}</div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Date</th>
                    <th className="py-2 font-semibold">Mode</th>
                    <th className="py-2 font-semibold">Reference</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2">{fmtDate(p.paid_on)}</td>
                      <td className="py-2 font-semibold">{MODE_LABEL[p.mode]}</td>
                      <td className="py-2">{p.reference || "—"}</td>
                      <td className="px-4 py-2 text-right tabular font-semibold">{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex justify-between border-t bg-muted/60 px-4 py-2 text-[12px] font-bold">
              <span>Paid {inr(calc.paid)}</span>
              <span className={calc.due > 0 ? "text-brand" : "text-present-ink"}>
                {calc.due > 0 ? `Balance due ${inr(calc.due)}` : "Fully paid"}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden rounded-xl border">
            <div className="bg-muted px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Advance</div>
            <div className="divide-y px-4 text-[12px]">
              {[
                ["Opening balance", calc.advanceOpening],
                ["Given this month", calc.advanceGiven],
                ["Recovered", calc.advanceRecovered],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5">
                  <span>{k}</span>
                  <span className="tabular font-semibold">{inr(v as number)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t bg-muted/60 px-4 py-2 text-[12px] font-bold">
              <span>Carry forward</span>
              <span className="tabular">{inr(calc.advanceClosing)}</span>
            </div>
          </div>
        </div>

        {(data.driver.bank_account || data.driver.upi_id) && (
          <div className="text-[12px] text-muted-foreground">
            {data.driver.bank_account && `Bank A/c ${data.driver.bank_account}${data.driver.bank_ifsc ? ` (IFSC ${data.driver.bank_ifsc})` : ""}`}
            {data.driver.bank_account && data.driver.upi_id && "  ·  "}
            {data.driver.upi_id && `UPI ${data.driver.upi_id}`}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ── Attendance report ───────────────────────────────────────
export function AttendanceReport({ data, calc }: { data: DriverData; calc: MonthCalc }) {
  const blanks = (new Date(calc.month).getDay() + 6) % 7;
  const special = calc.days.filter((d) => d.employed && (d.source !== "default" || d.note));
  return (
    <div className="flex min-h-[1123px] flex-col bg-white font-sans text-foreground">
      <DocHeader data={data} title="Attendance report" month={calc.month} />
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
