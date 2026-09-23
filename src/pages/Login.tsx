import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Truck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { loadPortal, NotFoundError } from "@/lib/store";
import { errorMessage, normalizeCode } from "@/lib/utils";
import { Button, Field, Input, PasswordInput } from "@/components/ui";
import { LanguageSwitcher } from "@/components/shell";

type AdminMode = "signin" | "forgot";

/** Shared dark page frame for both sign-in screens. */
function AuthLayout({ title, sub, badge, children }: { title: string; sub: string; badge: ReactNode; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-ink">
      <div className="relative overflow-hidden px-6 pb-24 pt-[max(2rem,env(safe-area-inset-top))] text-ink-foreground">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute -left-20 top-24 size-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-md items-center justify-between">
          <img src="/logo-white.png" alt="Ambica Enterprise" className="h-16 w-auto sm:h-20" />
          <LanguageSwitcher dark />
        </div>
        <div className="relative mx-auto mt-10 max-w-md">
          {badge}
          <h1 className="mt-3 font-display text-4xl font-bold">{title}</h1>
          <p className="mt-1 text-white/70">{sub}</p>
        </div>
      </div>

      <div className="relative z-10 -mt-16 flex-1 rounded-t-[28px] bg-background px-5 pb-10 pt-7">
        <div className="mx-auto max-w-md">
          {!supabaseConfigured && (
            <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{t("setup_needed")}</div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { t } = useI18n();
  return (
    <AuthLayout
      title={t("login_title")}
      sub={t("admin_sign_in_sub")}
      badge={
        <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-foreground">
          <ShieldCheck className="size-3.5" /> {t("tab_admin")}
        </span>
      }
    >
      <AdminLogin />
    </AuthLayout>
  );
}

/** Drivers sign in on their own page: /driver */
export function DriverLoginPage() {
  const { t } = useI18n();
  return (
    <AuthLayout
      title={t("login_title")}
      sub={t("driver_sign_in_sub")}
      badge={
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold">
          <Truck className="size-3.5" /> {t("tab_driver")}
        </span>
      }
    >
      <DriverLogin />
    </AuthLayout>
  );
}

function DriverLogin() {
  const { t } = useI18n();
  const { setDriverCode } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (!navigator.onLine) return toast.error(t("needs_internet"));
    const c = normalizeCode(code);
    setBusy(true);
    try {
      const data = await loadPortal(c);
      qc.setQueryData(["portal", c], data);
      setDriverCode(c);
      nav("/me", { replace: true });
    } catch (err) {
      toast.error(err instanceof NotFoundError ? t("id_not_found") : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label={t("driver_id")} hint={t("driver_id_hint")}>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="AMB-XXXXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-14 text-center font-display text-2xl font-bold tracking-[0.15em]"
        />
      </Field>
      <Button type="submit" size="lg" variant="ink" className="w-full" loading={busy}>
        <KeyRound className="size-5" /> {t("continue")}
      </Button>
    </form>
  );
}

function AdminLogin() {
  const { t } = useI18n();
  const { recheckAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [mode, setModeState] = useState<AdminMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setMode = (m: AdminMode) => {
    setModeState(m);
    setError(null);
  };

  /** Turn Supabase auth errors into plain words. */
  const explain = (err: unknown) => {
    const code = (err as { code?: string }).code ?? "";
    const msg = errorMessage(err);
    if (code === "email_not_confirmed" || /not confirmed/i.test(msg)) return t("err_not_confirmed");
    if (code === "invalid_credentials" || /invalid login/i.test(msg)) return t("err_wrong_password");
    if (code === "over_email_send_rate_limit" || /rate limit|too many/i.test(msg)) return t("err_rate_limit");
    if (code === "user_already_exists" || /already registered/i.test(msg)) return t("have_account");
    return msg;
  };

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!navigator.onLine) return setError(t("needs_internet"));
    setError(null);
    setBusy(true);
    try {
      const em = email.trim().toLowerCase();
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: `${location.origin}/reset` });
        if (error) throw error;
        toast.success(t("reset_sent"));
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (error) throw error;
        if (await recheckAdmin()) nav("/admin", { replace: true });
        else {
          setError(t("not_admin"));
          await signOut();
        }
      }
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">
          {error}
        </div>
      )}
      <Field label={t("email")}>
        <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {mode === "signin" && (
        <Field label={t("password")}>
          <PasswordInput
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      )}
      {mode === "forgot" && <p className="text-sm text-muted-foreground">{t("forgot_hint")}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {mode === "signin" ? t("sign_in") : t("continue")}
      </Button>
      <div className="flex flex-col items-center gap-2 pt-2 text-sm">
        {mode === "signin" ? (
          <button type="button" className="text-muted-foreground" onClick={() => setMode("forgot")}>
            {t("forgot_password")}
          </button>
        ) : (
          <button type="button" className="font-semibold text-brand" onClick={() => setMode("signin")}>
            {t("back")}
          </button>
        )}
      </div>
    </form>
  );
}

export function ResetPassword() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(t("password_updated"));
    nav("/admin", { replace: true });
  };
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl font-bold">{t("set_password")}</h1>
        <Field label={t("new_password")}>
          <PasswordInput autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          {t("save")}
        </Button>
      </form>
    </div>
  );
}
