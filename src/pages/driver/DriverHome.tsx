import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { CalendarClock, CloudOff, FileText, LogOut, RefreshCw, Truck, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { usePortal } from "@/lib/data";
import { NotFoundError, useSyncState } from "@/lib/store";
import { buildLedger, dayPay } from "@/lib/payroll";
import { currentMonth, fmtDate, fmtMonth, monthOf, todayISO } from "@/lib/dates";
import { usePdfExport } from "@/lib/pdf";
import { cn, inr } from "@/lib/utils";
import { Avatar, Button, Card, FullScreenLoader, Row, SectionTitle } from "@/components/ui";
import { AttendanceCalendar, CalendarLegend, LiveAmount, MonthSwitcher, StatusTiles } from "@/components/attendance";
import { PayStatusBadge, SalaryBreakdown } from "@/components/salary";
import { SalarySlip } from "@/components/documents";
import { LanguageSwitcher } from "@/components/shell";

export default function DriverHome() {
  const { t, lang } = useI18n();
  const { driverCode, signOut } = useAuth();
  const { online } = useSyncState();
  const q = usePortal(driverCode);
  const [month, setMonth] = useState(currentMonth());
  const { exportPdf, busy, holder } = usePdfExport();

  const ledger = useMemo(() => (q.data ? buildLedger(q.data) : []), [q.data]);

  // ID was changed or removed by the admin → back to login.
  const idGone = q.error instanceof NotFoundError;
  useEffect(() => {
    if (idGone) void signOut();
  }, [idGone, signOut]);

  if (!driverCode) return <Navigate to="/driver" replace />;
  if (idGone) return <FullScreenLoader />;
  if (q.isPending) return <FullScreenLoader />;
  if (!q.data) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="mb-4 text-muted-foreground">{t("needs_internet")}</p>
          <Button onClick={() => q.refetch()}>{t("retry")}</Button>
        </div>
      </div>
    );
  }

  const data = q.data;
  const { driver } = data;
  const calc = ledger.find((m) => m.month === month) ?? ledger[ledger.length - 1];
  const isCurrent = calc.month === currentMonth();
  const todayDay = calc.days.find((d) => d.date === todayISO());
  const todayEarned = todayDay ? Math.round(dayPay(todayDay)) : 0;
  const payments = data.payments.filter((p) => p.month === calc.month);
  const updated = q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toLocaleTimeString(lang === "en" ? "en-IN" : `${lang}-IN`, { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="min-h-dvh pb-10">
      {/* Hero */}
      <div className="relative overflow-hidden bg-ink px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))] text-ink-foreground">
        <div className="absolute -right-24 -top-10 size-72 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -left-16 bottom-0 size-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative mx-auto max-w-lg">
          <div className="flex items-center justify-between py-3">
            <img src="/logo-white.png" alt="Ambica Enterprise" className="h-12 w-auto" />
            <div className="flex items-center gap-2">
              <LanguageSwitcher dark />
              <button onClick={() => void signOut()} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label={t("sign_out")}>
                <LogOut className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <Avatar src={driver.photo_url} name={driver.name} className="size-16 text-xl ring-4 ring-white/10" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-bold">{driver.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 text-sm text-white/70">
                <span className="font-mono">{driver.login_code}</span>
                {driver.truck_number && <span className="inline-flex items-center gap-1"><Truck className="size-3.5" />{driver.truck_number}</span>}
              </div>
            </div>
          </div>

          {/* Live salary */}
          <div className="mt-6 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur">
            <div className="text-sm text-white/70">{t("my_salary", { month: fmtMonth(calc.month, lang) })}</div>
            <LiveAmount value={calc.net} className="mt-1 block font-display text-5xl font-bold text-white" />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {isCurrent && todayEarned > 0 && (
                <span className="rounded-full bg-present/25 px-2.5 py-1 font-semibold text-white">{t("today_plus", { amt: inr(todayEarned) })}</span>
              )}
              {isCurrent && <span className="text-white/60">{t("live_hint")}</span>}
              {!isCurrent && <PayStatusBadge calc={calc} />}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-white/70">
              <CalendarClock className="size-4 text-gold" />
              {t("salary_paid_on", { month: fmtMonth(calc.month, lang), date: fmtDate(calc.dueDate, lang) })}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-5 px-4 pt-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {!online && <CloudOff className="size-3.5" />}
            {updated && t("last_updated", { time: updated })}
          </span>
          <button onClick={() => q.refetch()} className="inline-flex items-center gap-1 font-semibold text-brand" disabled={!online}>
            <RefreshCw className={cn("size-3.5", q.isFetching && "animate-spin")} /> {t("refresh")}
          </button>
        </div>

        <MonthSwitcher month={calc.month} onChange={setMonth} min={monthOf(driver.joining_date)} locked={calc.locked} />
        <StatusTiles calc={calc} />

        <Card className="p-5">
          <SectionTitle>{t("your_attendance")}</SectionTitle>
          <AttendanceCalendar calc={calc} />
          <CalendarLegend />
        </Card>

        <Card className="p-5">
          <SectionTitle>{t("salary_breakdown")}</SectionTitle>
          <SalaryBreakdown calc={calc} />
          {(calc.complete || calc.locked) && (
            <Button
              variant="outline"
              className="mt-4 w-full"
              loading={busy}
              onClick={() => exportPdf(<SalarySlip data={data} calc={calc} />, `Salary-Slip-${calc.month.slice(0, 7)}.pdf`)}
            >
              <FileText className="size-4" /> {t("salary_slip")}
            </Button>
          )}
        </Card>

        {payments.length > 0 && (
          <Card className="p-5">
            <SectionTitle>{t("payments_received")}</SectionTitle>
            <ul className="divide-y">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="grid size-9 place-items-center rounded-lg bg-present-soft text-present-ink">
                    <Wallet className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{t(`mode_${p.mode}`)}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(p.paid_on, lang)}</div>
                  </div>
                  <div className="font-semibold tabular">{inr(p.amount)}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {calc.advanceClosing > 0 && (
          <Card className="bg-half-soft/60 p-4">
            <Row label={t("advance_balance")} value={inr(calc.advanceClosing)} strong />
          </Card>
        )}
      </div>
      {holder}
    </div>
  );
}
