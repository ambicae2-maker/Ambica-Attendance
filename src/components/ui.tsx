import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { DayStatus } from "@/lib/types";

// ── Button ──────────────────────────────────────────────────
type Variant = "primary" | "secondary" | "ghost" | "gold" | "danger" | "ink" | "outline";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-foreground hover:brightness-110 shadow-sm",
  gold: "bg-gold text-gold-foreground hover:brightness-105 shadow-sm",
  ink: "bg-ink text-ink-foreground hover:brightness-125",
  secondary: "bg-muted text-foreground hover:bg-border/70",
  outline: "border border-input bg-card text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  danger: "bg-danger/10 text-danger hover:bg-danger/15",
};
const SIZES = { sm: "h-9 px-3 text-sm gap-1.5", md: "h-11 px-4 text-[15px] gap-2", lg: "h-13 px-6 text-base gap-2", icon: "size-10" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// ── Form fields ─────────────────────────────────────────────
const fieldCls =
  "w-full rounded-lg border border-input bg-card px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none transition focus:border-brand focus:ring-3 focus:ring-brand/15 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(fieldCls, "h-11", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(fieldCls, "min-h-20 py-2.5", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(fieldCls, "h-11 appearance-none pr-8", className)} {...p} />
));
Select.displayName = "Select";

export function Field({ label, hint, error, optional, children, className }: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-semibold text-foreground">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">({t("optional")})</span>}
      </span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Money input with a ₹ prefix; whole rupees only. */
export function MoneyInput({ value, onChange, ...p }: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted-foreground">₹</span>
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        className="pl-8 tabular"
        {...p}
      />
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────
export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-soft", className)} {...p}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="font-display text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

export const STATUS_STYLES: Record<DayStatus, { solid: string; soft: string; dot: string }> = {
  present: { solid: "bg-present text-white", soft: "bg-present-soft text-present-ink", dot: "bg-present" },
  half: { solid: "bg-half text-gold-foreground", soft: "bg-half-soft text-half-ink", dot: "bg-half" },
  absent: { solid: "bg-absent text-white", soft: "bg-absent-soft text-absent-ink", dot: "bg-absent" },
  holiday: { solid: "bg-holiday text-white", soft: "bg-holiday-soft text-holiday-ink", dot: "bg-holiday" },
};

export function StatusBadge({ status }: { status: DayStatus }) {
  const { t } = useI18n();
  return (
    <Badge className={STATUS_STYLES[status].soft}>
      <span className={cn("size-1.5 rounded-full", STATUS_STYLES[status].dot)} />
      {t(`status_${status}`)}
    </Badge>
  );
}

// ── Avatar ──────────────────────────────────────────────────
export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-ink-foreground", className)}>
      {src && !failed ? (
        <img src={src} alt={name} crossOrigin="anonymous" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span className="font-display font-bold">{initials(name) || "?"}</span>
      )}
    </div>
  );
}

// ── Segmented control ───────────────────────────────────────
export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; activeClass?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 rounded-lg bg-muted p-1", className)} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-md px-2 py-2 text-sm font-semibold transition",
              active ? (o.activeClass ?? "bg-card text-foreground shadow-sm") : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Sheet (bottom sheet on phones, centered dialog on desktop) ──
export function Sheet({ open, onOpenChange, title, description, children, footer }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms]" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-card shadow-premium outline-none data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(0.22,1,0.36,1)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          aria-describedby={description ? undefined : undefined}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-start justify-between gap-3 px-5 pt-4">
            <div>
              <Dialog.Title className="font-display text-xl font-bold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : ""}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-2 rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label={t("close")}>
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">{children}</div>
          {footer && <div className="pb-safe border-t px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Confirm dialog (promise-based) ──────────────────────────
interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = (o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve }));
  const done = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Sheet
        open={!!state}
        onOpenChange={(o) => !o && done(false)}
        title={state?.title ?? ""}
        description={state?.message}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => done(false)}>
              {t("cancel")}
            </Button>
            <Button variant={state?.danger ? "primary" : "ink"} className="flex-1" onClick={() => done(true)}>
              {state?.confirmLabel ?? t("confirm")}
            </Button>
          </div>
        }
      />
    </ConfirmCtx.Provider>
  );
}

// ── Misc ────────────────────────────────────────────────────
export function EmptyState({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {sub && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-6 animate-spin text-brand", className)} />;
}

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner />
    </div>
  );
}

export function Row({ label, value, strong, muted, className }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2 text-[15px]", strong && "font-bold", muted && "text-muted-foreground", className)}>
      <span>{label}</span>
      <span className="tabular text-right">{value}</span>
    </div>
  );
}
