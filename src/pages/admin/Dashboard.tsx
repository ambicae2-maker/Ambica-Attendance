import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Plus, Search, Truck, UserX, Users, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDataset } from "@/lib/data";
import { driverSlice } from "@/lib/store";
import { buildLedger } from "@/lib/payroll";
import { currentMonth, fmtDate, fmtMonth, shiftMonth } from "@/lib/dates";
import { useToday } from "@/lib/today";
import { cn, inr } from "@/lib/utils";
import type { Dataset, Driver, MonthCalc } from "@/lib/types";
import { Avatar, Button, Card, EmptyState, FullScreenLoader, Input, StatusBadge } from "@/components/ui";
import { Page, PageHeader } from "@/components/shell";
import { LoadError } from "./common";

interface Row {
  driver: Driver;
  current: MonthCalc;
  previous: MonthCalc | undefined;
}

export function useDriverRows(ds: Dataset | undefined, today?: string): Row[] {
  return useMemo(() => {
    if (!ds) return [];
    const cur = currentMonth();
    const prev = shiftMonth(cur, -1);
    return ds.drivers.map((driver) => {
      const ledger = buildLedger(driverSlice(ds, driver.id)!, undefined, today);
      return { driver, current: ledger.find((m) => m.month === cur)!, previous: ledger.find((m) => m.month === prev) };
    });
  }, [ds, today]);
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { data: ds, isPending, error, refetch } = useDataset();
  const today = useToday();
  const rows = useDriverRows(ds, today);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const active = rows.filter((r) => r.driver.active);
  const todayStatus = (r: Row) => r.current?.days.find((d) => d.date === today);
  const stats = useMemo(() => {
    const s = { present: 0, half: 0, absent: 0, holiday: 0 };
    active.forEach((r) => {
      const d = todayStatus(r);
      if (d?.employed) s[d.status]++;
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const prevMonth = shiftMonth(currentMonth(), -1);
  const payroll = useMemo(() => {
    const list = rows.map((r) => r.previous).filter((m): m is MonthCalc => !!m && m.counts.employed > 0);
    return {
      net: list.reduce((s, m) => s + m.net, 0),
      paid: list.reduce((s, m) => s + Math.min(m.paid, m.net), 0),
      dueDate: list[0]?.dueDate,
      count: list.length,
    };
  }, [rows]);

  const filtered = rows
    .filter((r) => showInactive || r.driver.active)
    .filter((r) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return [r.driver.name, r.driver.login_code, r.driver.truck_number, r.driver.phone].some((v) => v?.toLowerCase().includes(s));
    })
    .sort((a, b) => Number(b.driver.active) - Number(a.driver.active) || a.driver.name.localeCompare(b.driver.name));

  if (isPending) return <FullScreenLoader />;
  if (error && !ds) return <LoadError error={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title={t("nav_home")}
        sub={fmtDate(today, lang, { weekday: "long", day: "numeric", month: "long" })}
        actions={
          <Link to="/admin/drivers/new" className="hidden md:block">
            <Button size="sm">
              <Plus className="size-4" /> {t("add_driver")}
            </Button>
          </Link>
        }
      />
      <Page>
        {/* Today at a glance */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Users className="size-5" />} label={t("active_drivers")} value={active.length} tone="ink" />
          <StatCard label={t("present_today")} value={stats.present + stats.holiday} tone="present" />
          <StatCard label={t("half_today")} value={stats.half} tone="half" />
          <StatCard icon={<UserX className="size-5" />} label={t("absent_today")} value={stats.absent} tone="absent" />
        </div>

        {payroll.count > 0 && (
          <Card className="flex items-center gap-4 border-gold/40 bg-gold/10 p-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold text-gold-foreground">
              <Wallet className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t("salary_due_for", { month: fmtMonth(prevMonth, lang) })}</div>
              <div className="font-display text-2xl font-bold tabular">{inr(payroll.net)}</div>
              <div className="text-xs text-muted-foreground">
                {t("paid_of", { paid: inr(payroll.paid), total: inr(payroll.net) })}
                {payroll.dueDate && ` · ${t("due_on", { date: fmtDate(payroll.dueDate, lang) })}`}
              </div>
            </div>
          </Card>
        )}

        {/* Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_drivers")} className="pl-10" />
          </div>
          {rows.some((r) => !r.driver.active) && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-[var(--brand)]" />
              {t("show_inactive")}
            </label>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Truck className="size-8" />}
            title={t("no_drivers")}
            sub={t("no_drivers_sub")}
            action={
              <Link to="/admin/drivers/new">
                <Button>
                  <Plus className="size-4" /> {t("add_driver")}
                </Button>
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">{t("no_results")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <DriverCard key={r.driver.id} row={r} todayDay={todayStatus(r)} />
            ))}
          </div>
        )}
      </Page>

      {/* Floating add button (mobile) */}
      <Link
        to="/admin/drivers/new"
        className="fixed bottom-24 right-5 z-30 grid size-14 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-premium transition active:scale-95 md:hidden"
        aria-label={t("add_driver")}
      >
        <Plus className="size-7" />
      </Link>
    </>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: number; tone: "ink" | "present" | "half" | "absent"; icon?: React.ReactNode }) {
  const cls = {
    ink: "bg-ink text-ink-foreground",
    present: "bg-present-soft text-present-ink",
    half: "bg-half-soft text-half-ink",
    absent: "bg-absent-soft text-absent-ink",
  }[tone];
  return (
    <div className={cn("flex flex-col justify-between rounded-xl p-4", cls)}>
      <div className="flex items-center justify-between text-xs font-semibold opacity-80">
        {label}
        {icon}
      </div>
      <div className="mt-2 font-display text-3xl font-bold tabular">{value}</div>
    </div>
  );
}

function DriverCard({ row, todayDay }: { row: Row; todayDay?: MonthCalc["days"][number] }) {
  const { t } = useI18n();
  const { driver, current } = row;
  return (
    <Link to={`/admin/drivers/${driver.id}`} className="group">
      <Card className={cn("flex items-center gap-4 p-4 transition group-hover:border-brand/40 group-active:scale-[0.99]", !driver.active && "opacity-60")}>
        <Avatar src={driver.photo_url} name={driver.name} className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-base font-bold">{driver.name}</h3>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="font-mono font-semibold">{driver.login_code}</span>
            {driver.truck_number && (
              <span className="inline-flex items-center gap-1">
                <Truck className="size-3" /> {driver.truck_number}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {!driver.active ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{t("inactive")}</span>
            ) : (
              todayDay?.employed && <StatusBadge status={todayDay.status} />
            )}
            {current && current.counts.absent > 0 && <span className="text-xs text-muted-foreground">{t("absent_n", { n: current.counts.absent })}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("this_month")}</div>
          <div className="font-display text-lg font-bold tabular">{inr(current?.net ?? 0)}</div>
          <ChevronRight className="ml-auto mt-1 size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}
