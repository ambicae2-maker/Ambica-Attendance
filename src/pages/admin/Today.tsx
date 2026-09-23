import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, PartyPopper, Search, Truck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { setAttendance, useDataset } from "@/lib/data";
import { fmtDate, monthOf, toISODate } from "@/lib/dates";
import { useToday } from "@/lib/today";
import { cn, errorMessage } from "@/lib/utils";
import { STATUS_ORDER } from "@/lib/payroll";
import type { DayStatus } from "@/lib/types";
import { Avatar, Card, FullScreenLoader, Input, STATUS_STYLES } from "@/components/ui";
import { Page, PageHeader } from "@/components/shell";
import { addDays, parseISO } from "date-fns";
import { LoadError } from "./common";

const SHORT: Record<DayStatus, string> = { present: "P", half: "½", absent: "A", holiday: "H" };

export default function Today() {
  const { t, lang } = useI18n();
  const { data: ds, isPending, error, refetch } = useDataset();
  const now = useToday();
  const [date, setDate] = useState(now);
  const [lastNow, setLastNow] = useState(now);
  if (now !== lastNow) {
    // the day rolled over while the screen was open
    setLastNow(now);
    if (date === lastNow) setDate(now);
  }
  const [q, setQ] = useState("");

  const holiday = ds?.holidays.find((h) => h.date === date);
  const defaultStatus: DayStatus = holiday ? "holiday" : "present";

  const rows = useMemo(() => {
    if (!ds) return [];
    const marks = new Map(ds.attendance.filter((a) => a.date === date).map((a) => [a.driver_id, a]));
    const lockedSet = new Set(ds.payroll_months.filter((p) => p.month === monthOf(date)).map((p) => p.driver_id));
    return ds.drivers
      .filter((d) => d.joining_date <= date && (!d.left_on || date <= d.left_on))
      .map((d) => ({ driver: d, status: marks.get(d.id)?.status ?? defaultStatus, locked: lockedSet.has(d.id) }))
      .sort((a, b) => a.driver.name.localeCompare(b.driver.name));
  }, [ds, date, defaultStatus]);

  const counts = rows.reduce((c, r) => ((c[r.status] = (c[r.status] ?? 0) + 1), c), {} as Record<DayStatus, number>);
  const visible = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    return !s || [r.driver.name, r.driver.truck_number, r.driver.login_code].some((v) => v?.toLowerCase().includes(s));
  });

  const mark = async (driverId: string, status: DayStatus) => {
    if (!ds) return;
    try {
      await setAttendance(ds, [driverId], date, status);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const shift = (n: number) => setDate(toISODate(addDays(parseISO(date), n)));

  if (isPending) return <FullScreenLoader />;
  if (error && !ds) return <LoadError error={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title={t("today_title")} sub={t("today_sub")} />
      <Page className="max-w-3xl">
        <Card className="flex items-center gap-2 p-2">
          <button onClick={() => shift(-1)} className="grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label="Previous day">
            <ChevronLeft className="size-5" />
          </button>
          <label className="relative flex-1 text-center">
            <div className="font-display text-lg font-bold">{fmtDate(date, lang, { weekday: "long", day: "numeric", month: "long" })}</div>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <button onClick={() => shift(1)} className="grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label="Next day">
            <ChevronRight className="size-5" />
          </button>
        </Card>

        {holiday && (
          <div className="flex items-center gap-2 rounded-xl bg-holiday-soft px-4 py-3 text-sm font-semibold text-holiday-ink">
            <PartyPopper className="size-4" /> {t("company_holiday_on", { name: holiday.name })}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          {STATUS_ORDER.map((s) => (
            <div key={s} data-testid={"tile-" + s} data-count={counts[s] ?? 0} className={cn("rounded-xl py-2.5 text-center", STATUS_STYLES[s].soft)}>
              <div className="font-display text-2xl font-bold tabular">{counts[s] ?? 0}</div>
              <div className="text-[11px] font-semibold uppercase opacity-80">{t(`status_${s}`)}</div>
            </div>
          ))}
        </div>

        {rows.length > 6 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_drivers")} className="pl-10" />
          </div>
        )}

        <div className="space-y-2">
          {visible.map(({ driver, status, locked }) => (
            <Card key={driver.id} className="flex items-center gap-3 p-3">
              <Link to={`/admin/drivers/${driver.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={driver.photo_url} name={driver.name} className="size-12" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{driver.name}</div>
                  <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {driver.truck_number ? <><Truck className="size-3" /> {driver.truck_number}</> : driver.login_code}
                  </div>
                </div>
              </Link>
              {locked ? (
                <Lock className="size-5 text-muted-foreground" />
              ) : (
                <div className="flex gap-1">
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => mark(driver.id, s)}
                      title={t(`status_${s}`)}
                      aria-label={t(`status_${s}`)}
                      aria-pressed={status === s}
                      className={cn(
                        "grid size-10 place-items-center rounded-lg text-sm font-bold transition active:scale-90",
                        status === s ? STATUS_STYLES[s].solid : "bg-muted text-muted-foreground",
                      )}
                    >
                      {SHORT[s]}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </Page>
    </>
  );
}
