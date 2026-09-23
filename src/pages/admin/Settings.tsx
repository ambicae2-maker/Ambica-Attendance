import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, History, LogOut, Mail, Monitor, Moon, Plus, ShieldCheck, Sun, Trash2 } from "lucide-react";
import { LANGS, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { addAdmin, removeAdmin, saveCompany, useDataset } from "@/lib/data";
import { DATASET_KEY, useSyncState } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/lib/utils";
import { useTheme, type ThemePref } from "@/lib/theme";
import type { Company } from "@/lib/types";
import { Button, Card, Field, FullScreenLoader, Input, Segmented, SectionTitle, Sheet, Textarea, useConfirm } from "@/components/ui";
import { Page, PageHeader, PhotoPicker, PoweredBy } from "@/components/shell";
import { notifySaved } from "./common";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { session, signOut } = useAuth();
  const { pending } = useSyncState();
  const confirm = useConfirm();
  const { data: ds, isPending } = useDataset();
  const [theme, setTheme] = useTheme();
  const [adminOpen, setAdminOpen] = useState(false);

  if (isPending || !ds) return <FullScreenLoader />;
  const me = session?.user.email?.toLowerCase();
  const isSuper = Boolean(ds.admins.find((a) => a.email === me)?.is_super);

  const onSignOut = async () => {
    if (pending > 0 && !(await confirm({ title: t("sign_out"), message: t("pending_changes", { n: pending }), danger: true }))) return;
    await signOut();
  };

  return (
    <>
      <PageHeader title={t("nav_settings")} sub={me} />
      <Page className="max-w-2xl">
        <CompanyCard company={ds.company} />

        <Card className="p-5">
          <SectionTitle
            action={
              isSuper && (
                <Button size="sm" variant="secondary" onClick={() => setAdminOpen(true)}>
                  <Plus className="size-4" /> {t("add")}
                </Button>
              )
            }
          >
            {t("admins")}
          </SectionTitle>
          <ul className="divide-y">
            {ds.admins.filter((a) => isSuper || a.email === me).map((a) => (
              <li key={a.email} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{a.name || a.email}</span>
                    {a.is_super && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-foreground dark:text-gold">
                        <ShieldCheck className="size-3" /> {t("super_admin")}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{a.email}</div>
                </div>
                {a.email === me ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{t("you")}</span>
                ) : (
                  isSuper && (
                    <button
                      onClick={async () => {
                        if (await confirm({ title: t("remove"), message: a.email, danger: true })) notifySaved(t, await removeAdmin(a.email));
                      }}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-danger"
                      aria-label={t("remove")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{isSuper ? t("admins_hint_super") : t("admins_hint")}</p>
        </Card>

        <Card className="space-y-4 p-5">
          <SectionTitle className="mb-0">{t("appearance")}</SectionTitle>
          <Field label={t("language")}>
            <Segmented value={lang} onChange={setLang} options={LANGS.map((l) => ({ value: l.code, label: l.label }))} />
          </Field>
          <Field label={t("theme")}>
            <Segmented<ThemePref>
              value={theme}
              onChange={setTheme}
              options={[
                { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun className="size-4" />{t("light")}</span> },
                { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon className="size-4" />{t("dark")}</span> },
                { value: "system", label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-4" />{t("system")}</span> },
              ]}
            />
          </Field>
        </Card>

        <Link to="/admin/activity">
          <Card className="flex items-center gap-3 p-4 hover:border-brand/40">
            <History className="size-5 text-muted-foreground" />
            <span className="flex-1 font-semibold">{t("activity")}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Card>
        </Link>

        <Button variant="danger" className="w-full" onClick={onSignOut}>
          <LogOut className="size-4" /> {t("sign_out")}
        </Button>

        <PoweredBy className="pt-2" />
      </Page>

      <AdminSheet open={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
}

function CompanyCard({ company }: { company: Company }) {
  const { t } = useI18n();
  const [c, setC] = useState(company);
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setC(company), [company]);
  const set = (k: keyof Company) => (e: { target: { value: string } }) => setC((s) => ({ ...s, [k]: e.target.value }));
  const dirty = logo !== null || JSON.stringify(c) !== JSON.stringify(company);

  const save = async () => {
    setBusy(true);
    try {
      notifySaved(t, await saveCompany({ ...c, pay_day: Math.min(28, Math.max(1, Number(c.pay_day) || 5)) }, logo ?? undefined));
      setLogo(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <SectionTitle className="mb-0">{t("company")}</SectionTitle>
      <Field label={t("logo")}>
        <PhotoPicker round={false} src={logo ?? c.logo_url ?? "/logo.png"} name={c.name} onPick={setLogo} />
      </Field>
      <Field label={t("company_name")}>
        <Input value={c.name} onChange={set("name")} />
      </Field>
      <Field label={t("address")}>
        <Textarea value={c.address} onChange={set("address")} rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("gst")}>
          <Input value={c.gst_number} onChange={set("gst_number")} className="uppercase" />
        </Field>
        <Field label={t("pay_day")} hint={t("pay_day_hint")}>
          <Input type="number" min={1} max={28} value={c.pay_day} onChange={set("pay_day")} />
        </Field>
        <Field label={t("phone")}>
          <Input type="tel" value={c.phone} onChange={set("phone")} />
        </Field>
        <Field label={t("email")}>
          <Input type="email" value={c.email} onChange={set("email")} />
        </Field>
      </div>
      <Button className="w-full" onClick={save} loading={busy} disabled={!dirty}>
        {t("save")}
      </Button>
    </Card>
  );
}

function AdminSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const { existing } = await addAdmin(email, name, () => qc.invalidateQueries({ queryKey: DATASET_KEY }));
      toast.success(t(existing ? "admin_invited_existing" : "admin_invited", { email: email.trim().toLowerCase() }));
      setEmail("");
      setName("");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("add_admin")}
      description={t("add_admin_hint")}
      footer={
        <Button className="w-full" size="lg" onClick={save} loading={busy} disabled={!valid}>
          <Mail className="size-4" /> {t("send_invite")}
        </Button>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
        <Field label={t("name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("email")}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </Field>
      </div>
    </Sheet>
  );
}
