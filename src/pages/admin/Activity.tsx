import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useI18n, type TFn } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useDataset } from "@/lib/data";
import { fmtDate, fmtMonth } from "@/lib/dates";
import { inr } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";
import { Card, EmptyState, FullScreenLoader } from "@/components/ui";
import { Page, PageHeader } from "@/components/shell";
import { LoadError } from "./common";

interface LogRow {
  id: number;
  at: string;
  actor: string | null;
  table_name: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  driver_id: string | null;
  row_data: Record<string, unknown> | null;
  old_data: Record<string, unknown> | null;
}

export default function Activity() {
  const { t, lang } = useI18n();
  const { data: ds } = useDataset();
  const q = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_log").select("*").order("at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as LogRow[];
    },
  });
  const names = new Map(ds?.drivers.map((d) => [d.id, d.name]));
  const adminNames = new Map(ds?.admins.map((a) => [a.email, a.name || a.email]));

  return (
    <>
      <PageHeader title={t("activity")} back="/admin/settings" />
      <Page>
        {q.isPending ? (
          <FullScreenLoader />
        ) : q.error ? (
          <LoadError error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState icon={<History className="size-8" />} title={t("none_added")} />
        ) : (
          <Card className="divide-y xl:grid xl:grid-cols-2 xl:divide-y-0">
            {q.data.map((r) => (
              <div key={r.id} className="border-b p-4 last:border-b-0 xl:border-b">
                <div className="text-sm">
                  <span className="font-bold">{adminNames.get(r.actor ?? "") ?? r.actor ?? "system"}</span>{" "}
                  {describe(r, t, lang, (id) => names.get(id ?? "") ?? "—")}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(lang === "en" ? "en-IN" : `${lang}-IN`, { dateStyle: "medium", timeStyle: "short" }).format(new Date(r.at))}
                </div>
              </div>
            ))}
          </Card>
        )}
      </Page>
    </>
  );
}

function describe(r: LogRow, t: TFn, lang: Lang, driverName: (id: string | null) => string): string {
  const row = (r.row_data ?? r.old_data ?? {}) as Record<string, string & number>;
  const driver = driverName(r.driver_id) === "—" ? String(row.name ?? "—") : driverName(r.driver_id);
  const date = (d?: string) => (d ? fmtDate(d, lang) : "");
  switch (r.table_name) {
    case "attendance":
      return r.action === "DELETE"
        ? t("act_reset", { driver, date: date(row.date) })
        : t("act_marked", { driver, status: t(`status_${row.status}`), date: date(row.date) });
    case "drivers":
      return r.action === "INSERT" ? t("act_driver_added", { driver }) : t("act_driver_updated", { driver });
    case "salary_history":
      return t("act_salary", { driver, amt: inr(row.monthly_salary), date: date(row.effective_from) });
    case "adjustments":
      return t(r.action === "DELETE" ? "act_adjustment_del" : "act_adjustment", { driver, kind: t(row.kind), amt: inr(row.amount) });
    case "payments":
      return r.action === "DELETE"
        ? t("act_payment_del", { driver, amt: inr(row.amount) })
        : t("act_payment", { driver, amt: inr(row.amount), mode: t(`mode_${row.mode}`) });
    case "payroll_months":
      return t(r.action === "DELETE" ? "act_unlocked" : "act_locked", { driver, month: fmtMonth(row.month, lang) });
    case "holidays":
      return r.action === "DELETE" ? t("act_holiday_removed", { name: row.name }) : t("act_holiday_added", { name: row.name, date: date(row.date) });
    case "admins":
      return t("act_admin", { name: row.email });
    case "company_settings":
      return t("act_company");
    default:
      return t("act_other", { table: r.table_name });
  }
}
