import { useState } from "react";
import { toast } from "sonner";
import { PartyPopper, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { addHoliday, removeHoliday, useDataset } from "@/lib/data";
import { fmtDate, todayISO } from "@/lib/dates";
import { errorMessage } from "@/lib/utils";
import { Button, Card, EmptyState, Field, FullScreenLoader, Input, Sheet, useConfirm } from "@/components/ui";
import { Page, PageHeader } from "@/components/shell";
import { notifySaved } from "./common";

export default function Holidays() {
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const { data: ds, isPending } = useDataset();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  if (isPending) return <FullScreenLoader />;
  const holidays = (ds?.holidays ?? []).filter((h) => h.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
  const today = todayISO();

  const save = async () => {
    if (!name.trim()) return;
    try {
      notifySaved(t, await addHoliday(date, name.trim()));
      setName("");
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title={t("holidays_title")}
        sub={t("holidays_sub")}
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> {t("add")}</Button>}
      />
      <Page className="max-w-2xl">
        <div className="flex items-center justify-center gap-2">
          {[year - 1, year, year + 1].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={y === year ? "rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-ink-foreground" : "rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground"}
            >
              {y}
            </button>
          ))}
        </div>

        {holidays.length === 0 ? (
          <EmptyState icon={<PartyPopper className="size-8" />} title={t("no_holidays")} sub={t("holiday_driver_hint")} />
        ) : (
          <Card className="divide-y">
            {holidays.map((h) => (
              <div key={h.id} className={h.date < today ? "flex items-center gap-4 p-4 opacity-60" : "flex items-center gap-4 p-4"}>
                <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-holiday-soft py-2 text-holiday-ink">
                  <span className="font-display text-xl font-bold leading-none">{h.date.slice(8)}</span>
                  <span className="text-[10px] font-bold uppercase">{fmtDate(h.date, lang, { month: "short" })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{h.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(h.date, lang, { weekday: "long" })}</div>
                </div>
                <button
                  onClick={async () => {
                    if (await confirm({ title: t("delete"), message: h.name, danger: true })) notifySaved(t, await removeHoliday(h.id));
                  }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-danger"
                  aria-label={t("delete")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </Card>
        )}
        {holidays.length > 0 && <p className="text-center text-xs text-muted-foreground">{t("holiday_driver_hint")}</p>}
      </Page>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("add_holiday")}
        description={t("holidays_sub")}
        footer={<Button className="w-full" size="lg" onClick={save} disabled={!name.trim()}>{t("save")}</Button>}
      >
        <div className="space-y-4">
          <Field label={t("holiday_name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali" autoFocus />
          </Field>
          <Field label={t("date")}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
