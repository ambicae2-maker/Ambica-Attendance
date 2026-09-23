import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { changeSalary, createDriver, updateDriver, useDataset, type DriverInput } from "@/lib/data";
import { salaryOn } from "@/lib/payroll";
import { todayISO } from "@/lib/dates";
import { errorMessage } from "@/lib/utils";
import type { Driver } from "@/lib/types";
import { Button, Card, Field, FullScreenLoader, Input, MoneyInput, Textarea } from "@/components/ui";
import { Page, PageHeader, PhotoPicker } from "@/components/shell";
import { notifySaved } from "./common";

export default function DriverForm() {
  const { id } = useParams();
  const { data: ds, isPending } = useDataset();
  if (isPending) return <FullScreenLoader />;
  const existing = id ? ds?.drivers.find((d) => d.id === id) : undefined;
  const salary = existing && ds ? salaryOn(ds.salary_history.filter((s) => s.driver_id === existing.id), todayISO()) : 0;
  return <Form key={id ?? "new"} existing={existing} currentSalary={salary} />;
}

function Form({ existing, currentSalary }: { existing?: Driver; currentSalary: number }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [f, setF] = useState({
    name: existing?.name ?? "",
    truck_number: existing?.truck_number ?? "",
    phone: existing?.phone ?? "",
    email: existing?.email ?? "",
    address: existing?.address ?? "",
    joining_date: existing?.joining_date ?? todayISO(),
    salary: existing ? String(Math.round(currentSalary)) : "",
    overtime_hour_rate: existing?.overtime_hour_rate ? String(existing.overtime_hour_rate) : "",
    bank_account: existing?.bank_account ?? "",
    bank_ifsc: existing?.bank_ifsc ?? "",
    upi_id: existing?.upi_id ?? "",
    notes: existing?.notes ?? "",
  });
  const [photo, setPhoto] = useState<DriverInput["photo"]>({ url: existing?.photo_url ?? null });
  const [salaryFrom, setSalaryFrom] = useState(todayISO());
  const salaryChanged = !!existing && Number(f.salary) > 0 && Number(f.salary) !== Math.round(currentSalary);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const photoSrc = "dataUrl" in photo ? photo.dataUrl : photo.url;

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = t("name_required");
    if (!(Number(f.salary) > 0)) errs.salary = t("salary_required");
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const clean = (s: string) => s.trim() || null;
    const input: DriverInput = {
      name: f.name.trim(),
      truck_number: clean(f.truck_number)?.toUpperCase() ?? null,
      phone: clean(f.phone),
      email: clean(f.email),
      address: clean(f.address),
      joining_date: f.joining_date,
      overtime_hour_rate: f.overtime_hour_rate ? Number(f.overtime_hour_rate) : null,
      bank_account: clean(f.bank_account),
      bank_ifsc: clean(f.bank_ifsc)?.toUpperCase() ?? null,
      upi_id: clean(f.upi_id),
      notes: clean(f.notes),
      photo,
    };

    setBusy(true);
    try {
      if (existing) {
        let synced = await updateDriver(existing, input);
        if (salaryChanged) synced = (await changeSalary(existing.id, Number(f.salary), salaryFrom)) && synced;
        notifySaved(t, synced);
        nav(`/admin/drivers/${existing.id}`, { replace: true });
      } else {
        const { driver, synced } = await createDriver(input, Number(f.salary));
        notifySaved(t, synced, t("driver_created", { code: driver.login_code }));
        nav(`/admin/drivers/${driver.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={existing ? t("edit_driver") : t("new_driver")} back />
      <Page className="max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <Card className="space-y-5 p-5">
            <PhotoPicker
              src={photoSrc}
              name={f.name}
              onPick={(dataUrl) => setPhoto({ dataUrl })}
              onRemove={() => setPhoto({ url: null })}
            />
            <Field label={t("full_name")} error={errors.name}>
              <Input value={f.name} onChange={set("name")} autoComplete="off" autoFocus={!existing} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("truck_number")} optional>
                <Input value={f.truck_number} onChange={set("truck_number")} placeholder="GJ 01 AB 1234" className="uppercase" />
              </Field>
              <Field label={t("phone")} optional>
                <Input type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("joining_date")}>
                <Input type="date" value={f.joining_date} max={todayISO()} onChange={set("joining_date")} required />
              </Field>
              <Field label={t("monthly_salary")} error={errors.salary}>
                <MoneyInput value={f.salary} onChange={(v) => setF((s) => ({ ...s, salary: v }))} placeholder="18000" />
              </Field>
            </div>
            {salaryChanged && (
              <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
                <Field label={t("effective_from")} hint={t("salary_effective_hint")}>
                  <Input type="date" value={salaryFrom} min={f.joining_date} onChange={(e) => setSalaryFrom(e.target.value)} required />
                </Field>
              </div>
            )}
            <Field label={t("overtime_rate")} optional>
              <MoneyInput value={f.overtime_hour_rate} onChange={(v) => setF((s) => ({ ...s, overtime_hour_rate: v }))} />
            </Field>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-display text-lg font-bold">{t("details")}</h2>
            <Field label={t("email")} optional>
              <Input type="email" value={f.email} onChange={set("email")} />
            </Field>
            <Field label={t("address")} optional>
              <Textarea value={f.address} onChange={set("address")} rows={2} />
            </Field>
            <h3 className="pt-2 text-sm font-bold text-muted-foreground">{t("payment_details")}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("bank_account")} optional>
                <Input inputMode="numeric" value={f.bank_account} onChange={set("bank_account")} />
              </Field>
              <Field label={t("ifsc")} optional>
                <Input value={f.bank_ifsc} onChange={set("bank_ifsc")} className="uppercase" />
              </Field>
            </div>
            <Field label={t("upi")} optional>
              <Input value={f.upi_id} onChange={set("upi_id")} placeholder="name@upi" />
            </Field>
            <Field label={t("notes")} optional>
              <Textarea value={f.notes} onChange={set("notes")} rows={2} />
            </Field>
          </Card>

          <div className="pb-safe sticky bottom-20 z-20 md:bottom-4">
            <Button type="submit" size="lg" className="w-full shadow-premium" loading={busy}>
              {existing ? t("save") : t("add_driver")}
            </Button>
          </div>
        </form>
      </Page>
    </>
  );
}
