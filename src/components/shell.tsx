import { useRef, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CalendarCheck, CloudOff, Globe, Home, ImagePlus, Loader2, PartyPopper, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useSyncState } from "@/lib/store";
import { LANGS, useI18n } from "@/lib/i18n";
import { cn, compressImage, errorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, Button } from "./ui";

export function SyncBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  const { online, pending, syncing } = useSyncState();
  if (online && !pending && !syncing) return null;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        online ? "bg-half-soft text-half-ink" : "bg-absent-soft text-absent-ink",
        className,
      )}
      title={pending ? t("pending_changes", { n: pending }) : undefined}
    >
      {!online ? <CloudOff className="size-3.5" /> : <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />}
      {!online ? t("offline") : syncing ? t("syncing") : pending}
      {!online && pending > 0 && <span className="tabular">· {pending}</span>}
    </div>
  );
}

export function LanguageSwitcher({ className, dark }: { className?: string; dark?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={cn("flex items-center gap-0.5 rounded-full p-0.5", dark ? "bg-white/10" : "bg-muted", className)}>
      <Globe className={cn("mx-1.5 size-3.5", dark ? "text-white/60" : "text-muted-foreground")} />
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold transition",
            lang === l.code
              ? dark
                ? "bg-white text-ink"
                : "bg-card text-foreground shadow-sm"
              : dark
                ? "text-white/70"
                : "text-muted-foreground",
          )}
          aria-pressed={lang === l.code}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

/** Photo from camera or gallery, compressed on the device. */
export function PhotoPicker({ src, name, onPick, onRemove, round = true }: {
  src: string | null;
  name: string;
  onPick: (dataUrl: string) => void;
  onRemove?: () => void;
  round?: boolean;
}) {
  const { t } = useI18n();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onPick(await compressImage(file, round ? 640 : 512));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {round ? (
          <Avatar src={src} name={name || "?"} className="size-24 text-2xl ring-4 ring-muted" />
        ) : (
          <div className="grid size-24 place-items-center overflow-hidden rounded-xl border bg-muted">
            {src ? <img src={src} alt="" className="size-full object-contain" /> : <ImagePlus className="size-7 text-muted-foreground" />}
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-ink/50">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {round && (
            <Button type="button" variant="ink" size="sm" onClick={() => camera.current?.click()}>
              <Camera className="size-4" /> {t("take_photo")}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => gallery.current?.click()}>
            <ImagePlus className="size-4" /> {t("upload_photo")}
          </Button>
        </div>
        {src && onRemove && (
          <Button type="button" variant="ghost" size="sm" className="self-start text-danger" onClick={onRemove}>
            <Trash2 className="size-4" /> {t("remove_photo")}
          </Button>
        )}
      </div>
      <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => (handle(e.target.files?.[0]), (e.target.value = ""))} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => (handle(e.target.files?.[0]), (e.target.value = ""))} />
    </div>
  );
}

// ── Admin layout ────────────────────────────────────────────
const NAV = [
  { to: "/admin", icon: Home, key: "nav_home", end: true },
  { to: "/admin/today", icon: CalendarCheck, key: "nav_today" },
  { to: "/admin/holidays", icon: PartyPopper, key: "nav_holidays" },
  { to: "/admin/settings", icon: Settings, key: "nav_settings" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh md:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-ink p-5 text-ink-foreground md:flex">
        <div className="mb-8">
          <img src="/logo-white.png" alt="Ambica Enterprise" className="h-20 w-auto" />
          <div className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{t("app_name")}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                  isActive ? "bg-brand text-brand-foreground" : "text-white/70 hover:bg-white/10 hover:text-white",
                )
              }
            >
              <n.icon className="size-5" />
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <SyncBadge />
          <LanguageSwitcher dark />
        </div>
      </aside>

      <main className="pb-24 md:pb-10">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur-lg md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", isActive ? "text-brand" : "text-muted-foreground")
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", isActive && "bg-brand/10")}>
                    <n.icon className="size-5" />
                  </span>
                  {t(n.key)}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({ title, sub, back, actions }: { title: ReactNode; sub?: ReactNode; back?: boolean | string; actions?: ReactNode }) {
  const nav = useNavigate();
  const { t } = useI18n();
  return (
    <header className="pt-safe sticky top-0 z-30 border-b bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
        {back && (
          <button
            onClick={() => (typeof back === "string" ? nav(back) : nav(-1))}
            className="-ml-2 grid size-10 place-items-center rounded-lg hover:bg-muted"
            aria-label={t("back")}
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold">{title}</h1>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <SyncBadge className="md:hidden" />
        {actions}
      </div>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-5xl space-y-5 px-4 py-5 md:px-8", className)}>{children}</div>;
}

/** Credit line shown at the bottom of the app and on printed documents. */
export function PoweredBy({ dark, className }: { dark?: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <p className={cn("text-center text-xs", dark ? "text-white/45" : "text-muted-foreground", className)}>
      {t("built_by")}{" "}
      <a
        href="https://kavionsolutions.in/"
        target="_blank"
        rel="noopener noreferrer"
        className={cn("font-semibold underline-offset-2 hover:underline", dark ? "text-white/70" : "text-brand")}
      >
        Kavion Solutions
      </a>
    </p>
  );
}
