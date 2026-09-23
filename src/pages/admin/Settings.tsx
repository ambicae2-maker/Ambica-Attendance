import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2, ChevronRight, History, LogOut, Mail, Monitor, Moon, Palette, Plus, ShieldCheck, Sun, Trash2, UserCog,
} from "lucide-react";
import { LANGS, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { addAdmin, removeAdmin, saveCompany, useDataset } from "@/lib/data";
import { DATASET_KEY, useSyncState } from "@/lib/store";
import { cn, errorMessage, initials } from "@/lib/utils";
import { useTheme, type ThemePref } from "@/lib/theme";
import type { Company } from "@/lib/types";
import { Button, Card, Field, FullScreenLoader, Input, Segmented, Sheet, Textarea, useConfirm } from "@/components/ui";
import { Page, PageHeader, PhotoPicker, PoweredBy } from "@/components/shell";
import { notifySaved } from "./common";

/** One settings section: icon, title, short description, optional action button. */
function Section({ icon, title, desc, action, children, className }: {
  icon: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-start gap-3 border-b bg-muted/40 px-5 py-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-ink-foreground dark:bg-brand/20 dark:text-brand">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold leading-tight">{title}</h2>
          {desc && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

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
  const admins = ds.admins.filter((a) => isSuper || a.email === me);

  const onSignOut = async () => {
    if (pending > 0 && !(await confirm({ title: t("sign_out"), message: t("pending_changes", { n: pending }), danger: true }))) return;
    await signOut();
  };

  return (
    <>
      <PageHeader title={t("nav_settings")} sub={me} />
      <Page className="max-w-5xl">
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-5">
            <CompanyCard company={ds.company} />
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <Section
              icon={<UserCog className="size-5" />}
              title={t("admins")}
              desc={isSuper ? t("admins_hint_super") : t("admins_hint")}
              action={
                isSuper && (
                  <Button size="sm" onClick={() => setAdminOpen(true)}>
                    <Plus className="size-4" /> {t("add")}
                  </Button>
                )
              }
            >
              {admins.length === 0 && <p className="py-1 text-sm text-muted-foreground">{t("none_added")}</p>}
              <ul className="-my-1 divide-y">
                {admins.map((a) => (
                  <li key={a.email} className="flex items-center gap-3 py-3">
                    <div
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold",
                        a.is_super ? "bg-gold/20 text-gold-foreground dark:text-gold" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {initials(a.name || a.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-semibold">{a.name || a.email}</span>
                        {a.email === me && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{t("you")}</span>
                        )}
                        {a.is_super && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-foreground dark:text-gold">
                            <ShieldCheck className="size-3" /> {t("super_admin")}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{a.email}</div>
                    </div>
                    {isSuper && a.email !== me && (
                      <button
                        onClick={async () => {
                          if (await confirm({ title: t("remove"), message: a.email, danger: true })) notifySaved(t, await removeAdmin(a.email));
                        }}
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                        aria-label={t("remove")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Section>

            <Section icon={<Palette className="size-5" />} title={t("appearance")}>
              <div className="space-y-4">
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
              </div>
            </Section>

            <Link to="/admin/activity" className="block">
              <Card className="flex items-center gap-3 p-4 transition hover:border-brand/40 hover:shadow-premium">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <History className="size-5" />
                </div>
                <span className="flex-1 font-semibold">{t("activity")}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Card>
            </Link>

            <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t("signed_in_as")}</div>
                <div className="truncate text-xs text-muted-foreground">{me}</div>
              </div>
              <Button variant="danger" onClick={onSignOut} className="sm:w-auto">
                <LogOut className="size-4" /> {t("sign_out")}
              </Button>
            </Card>
          </div>
        </div>

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
    <Section icon={<Building2 className="size-5" />} title={t("company")} desc={t("company_hint")}>
      <div className="space-y-4">
        <Field label={t("logo")}>
          <PhotoPicker round={false} src={logo ?? c.logo_url ?? "/logo.png"} name={c.name} onPick={setLogo} />
        </Field>
        <Field label={t("company_name")}>
          <Input value={c.name} onChange={set("name")} />
        </Field>
        <Field label={t("address")}>
          <Textarea value={c.address} onChange={set("address")} rows={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("gst")}>
            <Input value={c.gst_number} onChange={set("gst_number")} className="uppercase" />
          </Field>
          <Field label={t("pay_day")} hint={t("pay_day_hint")}>
            <Input type="number" min={1} max={28} value={c.pay_day} onChange={set("pay_day")} className="tabular" />
          </Field>
          <Field label={t("phone")}>
            <Input type="tel" value={c.phone} onChange={set("phone")} />
          </Field>
          <Field label={t("email")}>
            <Input type="email" value={c.email} onChange={set("email")} />
          </Field>
        </div>
      </div>
      <div className="pb-safe sticky bottom-20 z-10 mt-5 md:static md:bottom-auto">
        <Button
          variant={dirty ? "primary" : "secondary"}
          className={dirty ? "w-full shadow-premium md:shadow-none" : "w-full"}
          onClick={save}
          loading={busy}
          disabled={!dirty}
        >
          {dirty ? t("save") : t("saved")}
        </Button>
      </div>
    </Section>
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
