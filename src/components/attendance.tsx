import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { cn, inr } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { currentMonth, firstWeekday, fmtMonth, shiftMonth, todayISO, weekdayNames } from "@/lib/dates";
import type { DayInfo, DayStatus, MonthCalc } from "@/lib/types";
import { STATUS_STYLES } from "./ui";

// ── Month switcher ──────────────────────────────────────────
export function MonthSwitcher({ month, onChange, min, max = currentMonth(), locked }: {
  month: string;
  onChange: (m: string) => void;
  min?: string;
  max?: string;
  locked?: boolean;
}) {
  const { lang } = useI18n();
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-1.5 shadow-soft">
      <button
        className="grid size-10 place-items-center rounded-lg hover:bg-muted disabled:opacity-30"
        onClick={() => onChange(prev)}
        disabled={!!min && prev < min}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="flex items-center gap-2 font-display text-base font-bold">
        {fmtMonth(month, lang)}
        {locked && <Lock className="size-4 text-gold" />}
      </div>
      <button
        className="grid size-10 place-items-center rounded-lg hover:bg-muted disabled:opacity-30"
        onClick={() => onChange(next)}
        disabled={next > max}
        aria-label="Next month"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}

// ── Calendar ────────────────────────────────────────────────
export function AttendanceCalendar({ calc, onDayClick, compact }: {
  calc: MonthCalc;
  onDayClick?: (day: DayInfo) => void;
  compact?: boolean;
}) {
  const { lang } = useI18n();
  const today = todayISO();
  const blanks = firstWeekday(calc.month);

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted-foreground">
        {weekdayNames(lang).map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {calc.days.map((d) => {
          const style = STATUS_STYLES[d.status];
          const clickable = !!onDayClick && d.employed;
          const cls = !d.employed
            ? "bg-transparent text-muted-foreground/40"
            : d.future
              ? d.source === "default"
                ? "bg-muted/60 text-muted-foreground"
                : cn(style.soft, "opacity-70")
              : d.status === "present" && d.source === "default"
                ? style.soft
                : style.solid;
          return (
            <button
              key={d.date}
              type="button"
              disabled={!clickable}
              onClick={() => onDayClick?.(d)}
              title={d.holidayName ?? d.note ?? undefined}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-bold tabular transition",
                compact ? "text-xs" : "sm:text-base",
                cls,
                clickable && "hover:scale-105 active:scale-95",
                d.date === today && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            >
              {d.day}
              {d.note && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-current opacity-70" />}
              {d.source === "company" && !d.future && <span className="absolute bottom-1 size-1 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  const { t } = useI18n();
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {(["present", "half", "absent", "holiday"] as DayStatus[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={cn("size-3 rounded", STATUS_STYLES[s].solid)} />
          {t(`status_${s}`)}
        </span>
      ))}
    </div>
  );
}

// ── Stat tiles ──────────────────────────────────────────────
export function StatusTiles({ calc }: { calc: MonthCalc }) {
  const { t } = useI18n();
  const items: { s: DayStatus; n: number }[] = [
    { s: "present", n: calc.counts.present },
    { s: "half", n: calc.counts.half },
    { s: "absent", n: calc.counts.absent },
    { s: "holiday", n: calc.counts.holiday },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ s, n }) => (
        <div key={s} className={cn("rounded-xl px-2 py-3 text-center", STATUS_STYLES[s].soft)}>
          <div className="font-display text-2xl font-bold tabular">{n}</div>
          <div className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-wide opacity-80">{t(`status_${s}`)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Attendance ring ─────────────────────────────────────────
export function AttendanceRing({ calc, size = 96 }: { calc: MonthCalc; size?: number }) {
  const worked = calc.counts.present + calc.counts.holiday + calc.counts.half * 0.5;
  const total = calc.counts.employed - calc.counts.upcoming;
  const pct = total > 0 ? Math.round((worked / total) * 100) : 100;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          className="stroke-present transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-xl font-bold tabular">{pct}%</span>
      </div>
    </div>
  );
}

// ── Animated whole-rupee counter ────────────────────────────
export function LiveAmount({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const controls = animate(from, value, {
      duration: from === 0 ? 1.2 : 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = inr(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value]);
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {inr(0)}
    </span>
  );
}

// ── Six-month trend ─────────────────────────────────────────
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** Always six slim columns ending at the current month; months with no data show as empty tracks. */
export function TrendBars({ months, onPick, active }: { months: MonthCalc[]; onPick?: (m: string) => void; active?: string }) {
  const { lang } = useI18n();
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const end = currentMonth();
  const slots = Array.from({ length: 6 }, (_, i) => shiftMonth(end, i - 5));
  const max = Math.max(1, ...months.map((m) => m.net));

  return (
    <div className="grid grid-cols-6 gap-1">
      {slots.map((month) => {
        const m = byMonth.get(month);
        const isActive = month === active;
        const pct = m ? Math.max(6, (m.net / max) * 100) : 0;
        return (
          <button
            key={month}
            type="button"
            disabled={!m}
            onClick={() => m && onPick?.(month)}
            className={cn("group flex flex-col items-center rounded-xl px-1 py-2 transition", m && "hover:bg-muted", isActive && "bg-brand/5")}
          >
            <span className={cn("h-4 text-[11px] font-bold tabular", isActive ? "text-brand" : "text-foreground/80")}>
              {m ? "₹" + compact.format(m.net) : ""}
            </span>
            <div
              className={cn(
                "relative mt-1.5 h-24 w-3.5 overflow-hidden rounded-full sm:w-4",
                m ? "bg-muted" : "border border-dashed border-border bg-transparent",
              )}
            >
              {m && (
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 rounded-full transition-all duration-700",
                    isActive ? "bg-brand" : "bg-ink/75 group-hover:bg-ink dark:bg-steel",
                  )}
                  style={{ height: pct + "%" }}
                />
              )}
            </div>
            <span className={cn("mt-2 text-[11px] font-semibold", isActive ? "text-brand" : "text-muted-foreground")}>
              {fmtMonth(month, lang, true).split(" ")[0]}
            </span>
            <span className={cn("h-4 text-[10px] font-bold", m && m.counts.absent > 0 ? "text-absent" : "text-transparent")}>
              {m && m.counts.absent > 0 ? "−" + m.counts.absent : "0"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
