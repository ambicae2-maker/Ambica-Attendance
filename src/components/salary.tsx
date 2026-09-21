import { CalendarClock, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fmtDate, fmtMonth } from "@/lib/dates";
import { cn, inr } from "@/lib/utils";
import type { MonthCalc } from "@/lib/types";
import { Badge, Row } from "./ui";

export function PayStatusBadge({ calc }: { calc: MonthCalc }) {
  const { t } = useI18n();
  const cls = {
    paid: "bg-present-soft text-present-ink",
    partial: "bg-half-soft text-half-ink",
    unpaid: "bg-absent-soft text-absent-ink",
    none: "bg-muted text-muted-foreground",
  }[calc.payStatus];
  return <Badge className={cls}>{t(`pay_${calc.payStatus}`)}</Badge>;
}

/** Line-by-line salary for a month. Every line is a whole rupee and they add up exactly. */
export function SalaryBreakdown({ calc, showPayments = true }: { calc: MonthCalc; showPayments?: boolean }) {
  const { t, lang } = useI18n();
  const neg = (n: number) => (n ? `− ${inr(n)}` : inr(0));
  return (
    <div className="divide-y divide-dashed">
      <div className="pb-2">
        <Row label={t("monthly_salary")} value={inr(calc.monthlySalary)} />
        <p className="-mt-1 text-xs text-muted-foreground">
          {t("per_day_rate", { n: calc.daysInMonth, rate: inr(calc.dailyRate) })}
          {calc.salaryChanged && <span className="ml-2 font-semibold text-gold-foreground dark:text-gold">· {t("salary_changed_mid")}</span>}
        </p>
      </div>
      <div className="py-1">
        <Row label={t("full_month_pay")} value={inr(calc.fullMonth)} />
        {calc.absentDeduction > 0 && <Row label={t("absent_deduction", { n: calc.counts.absent })} value={neg(calc.absentDeduction)} muted />}
        {calc.halfDeduction > 0 && <Row label={t("half_deduction", { n: calc.counts.half })} value={neg(calc.halfDeduction)} muted />}
        {calc.pending > 0 && <Row label={t("pending_days", { n: calc.counts.upcoming })} value={neg(calc.pending)} muted />}
        <Row label={t("basic_earned")} value={inr(calc.basicEarned)} strong />
      </div>
      {(calc.bonus || calc.allowance || calc.overtime || calc.otherDeduction) > 0 && (
        <div className="py-1">
          {calc.bonus > 0 && <Row label={t("bonus")} value={`+ ${inr(calc.bonus)}`} className="text-present-ink" />}
          {calc.allowance > 0 && <Row label={t("allowance")} value={`+ ${inr(calc.allowance)}`} className="text-present-ink" />}
          {calc.overtime > 0 && <Row label={t("overtime")} value={`+ ${inr(calc.overtime)}`} className="text-present-ink" />}
          {calc.otherDeduction > 0 && <Row label={t("deduction")} value={neg(calc.otherDeduction)} muted />}
          <Row label={t("gross")} value={inr(calc.gross)} strong />
        </div>
      )}
      {calc.advanceRecovered > 0 && (
        <div className="py-1">
          <Row label={t("advance_recovered")} value={neg(calc.advanceRecovered)} muted />
        </div>
      )}
      <div className="pt-2">
        <div className="flex items-baseline justify-between rounded-lg bg-ink px-4 py-3 text-ink-foreground">
          <span className="font-semibold">{calc.complete || calc.locked ? t("net_pay") : t("net_so_far")}</span>
          <span className="font-display text-2xl font-bold tabular">{inr(calc.net)}</span>
        </div>
        {showPayments && (calc.paid > 0 || calc.complete) && (
          <div className="mt-2 px-1">
            <Row label={t("paid")} value={inr(calc.paid)} />
            {calc.due > 0 && <Row label={t("balance_due")} value={inr(calc.due)} strong className="text-brand" />}
          </div>
        )}
        <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          {calc.locked ? <Lock className="size-3.5" /> : <CalendarClock className="size-3.5" />}
          {t("salary_paid_on", { month: fmtMonth(calc.month, lang), date: fmtDate(calc.dueDate, lang) })}
        </p>
      </div>
    </div>
  );
}

export function AdvanceSummary({ calc, className }: { calc: MonthCalc; className?: string }) {
  const { t } = useI18n();
  if (!calc.advanceOpening && !calc.advanceGiven && !calc.advanceClosing) return null;
  return (
    <div className={cn("rounded-xl border bg-half-soft/50 p-4", className)}>
      <div className="mb-1 text-sm font-bold text-half-ink">{t("advance_ledger")}</div>
      <Row label={t("advance_opening")} value={inr(calc.advanceOpening)} />
      <Row label={t("advance_given")} value={`+ ${inr(calc.advanceGiven)}`} />
      <Row label={t("advance_recovered")} value={`− ${inr(calc.advanceRecovered)}`} />
      <Row label={t("advance_closing")} value={inr(calc.advanceClosing)} strong />
    </div>
  );
}
