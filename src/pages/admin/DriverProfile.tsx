import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarDays, Copy, FileText, History, Lock, Pencil, Phone, Plus, RefreshCw, Share2, Trash2, Truck, Unlock, UserCheck, UserX, Wallet,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  addAdjustment, addPayment, changeSalary, deleteSalary, lockMonth, regenerateCode, removeAdjustment, removePayment, setAttendance,
  setDriverActive, useDataset, useDriverData,
} from "@/lib/data";
import { buildLedger, STATUS_ORDER } from "@/lib/payroll";
import { currentMonth, dayDate, fmtDate, fmtMonth, monthOf, todayISO } from "@/lib/dates";
import { usePdfExport } from "@/lib/pdf";
import { cn, errorMessage, inr } from "@/lib/utils";
import type { AdjustmentKind, DayInfo, DayStatus, DriverData, MonthCalc, PaymentMode } from "@/lib/types";
import {
  Avatar, Button, Card, Field, FullScreenLoader, Input, MoneyInput, Row, Segmented, SectionTitle, Sheet, STATUS_STYLES, useConfirm,
} from "@/components/ui";
import { AttendanceCalendar, AttendanceRing, CalendarLegend, LiveAmount, MonthSwitcher, StatusTiles, TrendBars } from "@/components/attendance";
import { AdvanceSummary, PayStatusBadge, SalaryBreakdown } from "@/components/salary";
import { AttendanceReport, SalarySlip } from "@/components/documents";
import { Page, PageHeader } from "@/components/shell";
import { unlockMonth } from "@/lib/data";
import { notifySaved } from "./common";

export default function DriverProfile() {
  const { id } = useParams();
  const { data, isPending } = useDriverData(id);
  if (isPending) return <FullScreenLoader />;
  if (!data) return <NotFound />;
  return <Profile data={data} />;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("no_results")} back="/admin" />
    </>
  );
}

function Profile({ data }: { data: DriverData }) {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const confirm = useConfirm();
  const { data: ds } = useDataset();
  const { driver } = data;
  const [month, setMonth] = useState(currentMonth());
  const [dayOpen, setDayOpen] = useState<DayInfo | null>(null);
  const [sheet, setSheet] = useState<null | "extra" | "payment" | "salary">(null);
  const { exportPdf, busy: pdfBusy, holder } = usePdfExport();

  const ledger = useMemo(() => buildLedger(data), [data]);
  const calc = ledger.find((m) => m.month === month) ?? ledger[ledger.length - 1];
  const trend = ledger.slice(-6);
  const locked = calc.locked;
  const minMonth = monthOf(driver.joining_date);

  const monthAdjustments = data.adjustments.filter((a) => a.month === calc.month).sort((a, b) => a.date.localeCompare(b.date));
  const monthPayments = data.payments.filter((p) => p.month === calc.month).sort((a, b) => a.paid_on.localeCompare(b.paid_on));
  const salaries = [...data.salary_history].sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  const fileBase = `${driver.name.replace(/[^\p{L}\p{N}]+/gu, "-")}-${calc.month.slice(0, 7)}`;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(driver.login_code);
      toast.success(t("copied"));
    } catch {
      /* clipboard blocked */
    }
  };

  const onRegenerate = async () => {
    if (!(await confirm({ title: t("regenerate_id"), message: t("regenerate_confirm"), danger: true }))) return;
    const code = await regenerateCode(driver.id);
    toast.success(t("id_changed", { code }));
  };

  const onToggleActive = async () => {
    if (driver.active) {
      if (!(await confirm({ title: t("deactivate"), message: t("deactivate_confirm", { name: driver.name }), danger: true }))) return;
      notifySaved(t, await setDriverActive(driver.id, false, todayISO()));
    } else {
      notifySaved(t, await setDriverActive(driver.id, true, null));
    }
  };

  const onLock = async () => {
    if (locked) {
      if (!(await confirm({ title: t("unlock_month"), message: t("unlock_confirm", { month: fmtMonth(calc.month, lang) }) }))) return;
      notifySaved(t, await unlockMonth(driver.id, calc.month));
    } else {
      if (!(await confirm({ title: t("lock_month"), message: t("lock_confirm", { month: fmtMonth(calc.month, lang) }) }))) return;
      notifySaved(t, await lockMonth(driver.id, calc, session?.user.email ?? null));
    }
  };

  return (
    <>
      <PageHeader title={driver.name} sub={driver.login_code} back="/admin" actions={
        <Link to={`/admin/drivers/${driver.id}/edit`}>
          <Button variant="outline" size="sm"><Pencil className="size-4" /> <span className="hidden sm:inline">{t("edit")}</span></Button>
        </Link>
      } />
      <Page>
        {/* Identity */}
        <Card className="relative overflow-hidden border-0 bg-ink p-5 text-ink-foreground">
          <div className="absolute -right-16 -top-16 size-56 rounded-full bg-brand/30 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <Avatar src={driver.photo_url} name={driver.name} className="size-20 text-2xl ring-4 ring-white/10 sm:size-24" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-2xl font-bold">{driver.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                {driver.truck_number && <span className="inline-flex items-center gap-1"><Truck className="size-4" />{driver.truck_number}</span>}
                <span>{t("joining_date")}: {fmtDate(driver.joining_date, lang)}</span>
                {!driver.active && driver.left_on && <span className="text-gold">{t("left_on", { date: fmtDate(driver.left_on, lang) })}</span>}
              </div>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <button onClick={copyId} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm font-bold tracking-wider hover:bg-white/15">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-gold">{t("driver_id_label")}</span>
              {driver.login_code}
              <Copy className="size-3.5 opacity-70" />
            </button>
            <button onClick={onRegenerate} className="grid size-9 place-items-center rounded-lg bg-white/10 hover:bg-white/15" title={t("regenerate_id")} aria-label={t("regenerate_id")}>
              <RefreshCw className="size-4" />
            </button>
            {driver.phone && (
              <a href={`tel:${driver.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-present px-3 text-sm font-semibold text-white">
                <Phone className="size-4" /> {t("call")}
              </a>
            )}
            <button onClick={onToggleActive} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white/70 hover:bg-white/10">
              {driver.active ? <><UserX className="size-4" /> {t("deactivate")}</> : <><UserCheck className="size-4" /> {t("reactivate")}</>}
            </button>
          </div>
        </Card>

        <div className="sticky top-[61px] z-20 -mx-1 px-1 pt-1">
          <MonthSwitcher month={calc.month} onChange={setMonth} min={minMonth} locked={locked} />
        </div>

        <div className="grid gap-5 lg:grid-cols-5">
          {/* Left column */}
          <div className="space-y-5 lg:col-span-3">
            <Card className="p-5">
              <div className="flex items-center gap-5">
                <AttendanceRing calc={calc} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {calc.complete || locked ? t("net_pay") : t("net_so_far")}
                  </div>
                  <LiveAmount value={calc.net} className="font-display text-4xl font-bold" />
                  <div className="mt-1 flex items-center gap-2">
                    <PayStatusBadge calc={calc} />
                    {locked && <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-foreground dark:text-gold"><Lock className="size-3" /> {t("locked")}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <StatusTiles calc={calc} />
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle>{t("attendance")}</SectionTitle>
              {locked && <p className="mb-3 rounded-lg bg-gold/15 px-3 py-2 text-sm">{t("locked_hint")}</p>}
              <AttendanceCalendar calc={calc} onDayClick={locked ? undefined : (d) => setDayOpen(d)} />
              <CalendarLegend />
            </Card>

            <Card className="p-5">
              <SectionTitle
                action={!locked && (
                  <Button size="sm" variant="secondary" onClick={() => setSheet("extra")}>
                    <Plus className="size-4" /> {t("add")}
                  </Button>
                )}
              >
                {t("extras")}
              </SectionTitle>
              {monthAdjustments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("none_added")}</p>
              ) : (
                <ul className="divide-y">
                  {monthAdjustments.map((a) => {
                    const plus = a.kind === "bonus" || a.kind === "allowance" || a.kind === "overtime";
                    return (
                      <li key={a.id} className="flex items-center gap-3 py-2.5">
                        <div className={cn("grid size-9 place-items-center rounded-lg text-xs font-bold", plus ? "bg-present-soft text-present-ink" : a.kind === "advance" ? "bg-half-soft text-half-ink" : "bg-absent-soft text-absent-ink")}>
                          {plus ? "+" : "−"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">
                            {t(a.kind)}
                            {a.kind === "overtime" && a.quantity ? (
                              <span className="font-normal text-muted-foreground"> · {a.quantity} {a.unit === "hour" ? t("hours") : t("days")} × {inr(a.rate ?? 0)}</span>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{fmtDate(a.date, lang)}{a.note && ` · ${a.note}`}</div>
                        </div>
                        <div className="font-semibold tabular">{inr(a.amount)}</div>
                        {!locked && (
                          <button onClick={async () => notifySaved(t, await removeAdjustment(a.id))} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-danger" aria-label={t("delete")}>
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle>{t("trend")}</SectionTitle>
              <TrendBars months={trend} active={calc.month} onPick={setMonth} />
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-5 lg:col-span-2">
            <Card className="p-5">
              <SectionTitle>{t("salary_breakdown")}</SectionTitle>
              <SalaryBreakdown calc={calc} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" loading={pdfBusy} onClick={() => exportPdf(<AttendanceReport data={data} calc={calc} />, `Attendance-${fileBase}.pdf`)}>
                  <CalendarDays className="size-4" /> {t("attendance_pdf")}
                </Button>
                <Button variant="outline" size="sm" loading={pdfBusy} onClick={() => exportPdf(<SalarySlip data={data} calc={calc} />, `Salary-Slip-${fileBase}.pdf`)}>
                  <FileText className="size-4" /> {t("salary_slip")}
                </Button>
                <Button variant="ink" size="sm" loading={pdfBusy} onClick={() => exportPdf(<SalarySlip data={data} calc={calc} />, `Salary-Slip-${fileBase}.pdf`, "share")}>
                  <Share2 className="size-4" /> {t("share_slip")}
                </Button>
                <Button
                  variant={locked ? "secondary" : "gold"}
                  size="sm"
                  onClick={onLock}
                  disabled={!locked && !calc.complete}
                  title={!calc.complete ? fmtDate(calc.dueDate, lang) : undefined}
                >
                  {locked ? <><Unlock className="size-4" /> {t("unlock_month")}</> : <><Lock className="size-4" /> {t("lock_month")}</>}
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle
                action={
                  <Button size="sm" variant="secondary" onClick={() => setSheet("payment")}>
                    <Plus className="size-4" /> {t("add_payment")}
                  </Button>
                }
              >
                {t("payments")}
              </SectionTitle>
              {monthPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("none_added")}</p>
              ) : (
                <ul className="divide-y">
                  {monthPayments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <div className="grid size-9 place-items-center rounded-lg bg-present-soft text-present-ink">
                        <Wallet className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{t(`mode_${p.mode}`)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {fmtDate(p.paid_on, lang)}
                          {p.reference && ` · ${p.reference}`}
                        </div>
                      </div>
                      <div className="font-semibold tabular">{inr(p.amount)}</div>
                      <button onClick={async () => notifySaved(t, await removePayment(p.id))} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-danger" aria-label={t("delete")}>
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 border-t pt-2">
                <Row label={t("paid")} value={inr(calc.paid)} />
                <Row label={t("balance_due")} value={inr(calc.due)} strong className={calc.due > 0 ? "text-brand" : undefined} />
              </div>
            </Card>

            <AdvanceSummary calc={calc} />

            <Card className="p-5">
              <SectionTitle
                action={
                  <Button size="sm" variant="secondary" onClick={() => setSheet("salary")}>
                    <History className="size-4" /> {t("change_salary")}
                  </Button>
                }
              >
                {t("salary_history")}
              </SectionTitle>
              <ul className="divide-y">
                {salaries.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold tabular">{inr(s.monthly_salary)}</div>
                      <div className="text-xs text-muted-foreground">{t("from_date", { date: fmtDate(s.effective_from, lang) })}</div>
                    </div>
                    {i === 0 && <span className="rounded-full bg-present-soft px-2 py-0.5 text-xs font-semibold text-present-ink">{t("current")}</span>}
                    {salaries.length > 1 && (
                      <button onClick={async () => notifySaved(t, await deleteSalary(s.id))} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-danger" aria-label={t("delete")}>
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </Page>

      {dayOpen && ds && <DaySheet day={dayOpen} driverId={driver.id} onClose={() => setDayOpen(null)} dsHolidays={ds} />}
      <ExtraSheet open={sheet === "extra"} onClose={() => setSheet(null)} data={data} calc={calc} />
      <PaymentSheet open={sheet === "payment"} onClose={() => setSheet(null)} driverId={driver.id} calc={calc} />
      <SalarySheet open={sheet === "salary"} onClose={() => setSheet(null)} driverId={driver.id} />
      {holder}
    </>
  );
}

// ── Day sheet ───────────────────────────────────────────────
function DaySheet({ day, driverId, onClose, dsHolidays }: { day: DayInfo; driverId: string; onClose: () => void; dsHolidays: Parameters<typeof setAttendance>[0] }) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<DayStatus>(day.status);
  const [note, setNote] = useState(day.note ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      notifySaved(t, await setAttendance(dsHolidays, [driverId], day.date, status, note.trim() || null));
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("set_day", { date: fmtDate(day.date, lang, { weekday: "short", day: "numeric", month: "short" }) })}
      description={day.holidayName ? t("company_holiday_on", { name: day.holidayName }) : undefined}
      footer={<Button className="w-full" size="lg" onClick={save} loading={busy}>{t("save")}</Button>}
    >
      <StatusPicker value={status} onChange={setStatus} />
      <Field label={t("day_note")} className="mt-4">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Sheet>
  );
}

export function StatusPicker({ value, onChange }: { value: DayStatus; onChange: (s: DayStatus) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-2">
      {STATUS_ORDER.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "flex h-16 items-center justify-center gap-2 rounded-xl border-2 text-base font-bold transition active:scale-[0.98]",
            value === s ? cn(STATUS_STYLES[s].solid, "border-transparent shadow-soft") : "border-border bg-card text-foreground",
          )}
        >
          <span className={cn("size-2.5 rounded-full", value === s ? "bg-white/80" : STATUS_STYLES[s].dot)} />
          {t(`status_${s}`)}
        </button>
      ))}
    </div>
  );
}

// ── Extras / deductions / advance ───────────────────────────
const KINDS: AdjustmentKind[] = ["bonus", "allowance", "overtime", "deduction", "advance"];

function defaultDateFor(month: string) {
  const today = todayISO();
  return monthOf(today) === month ? today : dayDate(month, 1);
}

function ExtraSheet({ open, onClose, data, calc }: { open: boolean; onClose: () => void; data: DriverData; calc: MonthCalc }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<AdjustmentKind>("bonus");
  const [unit, setUnit] = useState<"hour" | "day">("hour");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDateFor(calc.month));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const defaultRate = unit === "hour" ? data.driver.overtime_hour_rate ?? 0 : calc.dailyRate;
  const effRate = rate === "" ? defaultRate : Number(rate);
  const total = kind === "overtime" ? Math.round((Number(qty) || 0) * effRate) : Number(amount) || 0;

  const reset = () => {
    setQty(""); setRate(""); setAmount(""); setNote(""); setDate(defaultDateFor(calc.month));
  };

  const save = async () => {
    if (total <= 0) return;
    if (monthOf(date) !== calc.month) setDate(defaultDateFor(calc.month));
    setBusy(true);
    try {
      const synced = await addAdjustment({
        driver_id: data.driver.id,
        date: monthOf(date) === calc.month ? date : defaultDateFor(calc.month),
        kind,
        unit: kind === "overtime" ? unit : null,
        quantity: kind === "overtime" ? Number(qty) : null,
        rate: kind === "overtime" ? effRate : null,
        amount: total,
        note: note.trim() || null,
      });
      notifySaved(t, synced);
      reset();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("extras")}
      footer={
        <Button className="w-full" size="lg" onClick={save} loading={busy} disabled={total <= 0}>
          {t("add")} {total > 0 && `· ${inr(total)}`}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm font-semibold transition",
                kind === k ? "border-transparent bg-ink text-ink-foreground" : "bg-card text-muted-foreground",
              )}
            >
              {k === "advance" ? t("give_advance") : t(k)}
            </button>
          ))}
        </div>

        {kind === "overtime" ? (
          <>
            <Field label={t("overtime_by")}>
              <Segmented value={unit} onChange={(u) => { setUnit(u); setRate(""); }} options={[{ value: "hour", label: t("per_hour") }, { value: "day", label: t("per_day") }]} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={unit === "hour" ? t("hours") : t("days")}>
                <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} />
              </Field>
              <Field label={t("rate")}>
                <MoneyInput value={rate} onChange={setRate} placeholder={String(Math.round(defaultRate))} />
              </Field>
            </div>
          </>
        ) : (
          <Field label={t("amount")}>
            <MoneyInput value={amount} onChange={setAmount} autoFocus />
          </Field>
        )}
        <Field label={t("date")}>
          <Input type="date" value={date} min={calc.days[0].date} max={calc.days[calc.days.length - 1].date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t("note")} optional>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

// ── Payment ─────────────────────────────────────────────────
const MODES: PaymentMode[] = ["cash", "upi", "bank", "cheque"];

function PaymentSheet({ open, onClose, driverId, calc }: { open: boolean; onClose: () => void; driverId: string; calc: MonthCalc }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const value = amount === "" ? calc.due : Number(amount);

  const save = async () => {
    if (!(value > 0)) return;
    setBusy(true);
    try {
      notifySaved(t, await addPayment({ driver_id: driverId, month: calc.month, amount: value, mode, reference: reference.trim() || null, paid_on: paidOn, note: note.trim() || null }));
      setAmount(""); setReference(""); setNote("");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("add_payment")}
      description={`${t("balance_due")}: ${inr(calc.due)}`}
      footer={<Button className="w-full" size="lg" onClick={save} loading={busy} disabled={!(value > 0)}><Wallet className="size-4" /> {t("save")} · {inr(value || 0)}</Button>}
    >
      <div className="space-y-4">
        <Field label={t("amount")}>
          <MoneyInput value={amount} onChange={setAmount} placeholder={String(calc.due)} />
        </Field>
        <Field label={t("mode")}>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn("h-12 rounded-xl border-2 text-sm font-bold transition", mode === m ? "border-brand bg-brand/10 text-brand" : "border-border bg-card")}
              >
                {t(`mode_${m}`)}
              </button>
            ))}
          </div>
        </Field>
        {mode !== "cash" && (
          <Field label={t("reference")} optional>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
        <Field label={t("paid_on")}>
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
        <Field label={t("note")} optional>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

// ── Change salary ───────────────────────────────────────────
function SalarySheet({ open, onClose, driverId }: { open: boolean; onClose: () => void; driverId: string }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!(Number(amount) > 0)) return;
    setBusy(true);
    try {
      notifySaved(t, await changeSalary(driverId, Number(amount), from));
      setAmount("");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("change_salary")}
      footer={<Button className="w-full" size="lg" onClick={save} loading={busy} disabled={!(Number(amount) > 0)}>{t("save")}</Button>}
    >
      <div className="space-y-4">
        <Field label={t("new_salary")}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label={t("effective_from")}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
