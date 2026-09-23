import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui";

/** Chrome/Android gives us this event so we can show our own install button. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SNOOZE_KEY = "install-snoozed-until";
const SNOOZE_DAYS = 14;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

function snoozed() {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 864e5));
  } catch {
    /* ignore */
  }
}

/** "Install this app" popup — Android/desktop get a real button, iPhone gets the steps. */
export function InstallPrompt() {
  const { t } = useI18n();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [show, setShow] = useState(false);
  const ios = isIOS();

  useEffect(() => {
    if (isStandalone() || snoozed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the browser's own bar hidden; we show our popup instead
      setEvent(e as InstallEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);

    // iPhone has no install event, so show the steps after a short delay.
    const timer = ios ? setTimeout(() => setShow(true), 2500) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, [ios]);

  if (!show) return null;

  const close = () => {
    snooze();
    setShow(false);
  };

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "dismissed") snooze();
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:left-auto sm:right-4 sm:w-96">
      <div className="relative overflow-hidden rounded-2xl bg-ink p-4 text-ink-foreground shadow-premium">
        <div className="absolute -right-10 -top-10 size-32 rounded-full bg-brand/30 blur-2xl" />
        <button
          onClick={close}
          aria-label={t("close")}
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
        <div className="relative flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 pr-6">
            <h3 className="font-display text-base font-bold">{t("install_title")}</h3>
            <p className="mt-0.5 text-sm text-white/70">{t("install_text")}</p>
          </div>
        </div>
        {ios && !event ? (
          <p className="relative mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm">
            <Share className="size-4 shrink-0 text-gold" />
            {t("install_ios")}
          </p>
        ) : (
          <div className="relative mt-3 flex gap-2">
            <Button variant="secondary" className="flex-1 bg-white/10 text-white hover:bg-white/20" onClick={close}>
              {t("not_now")}
            </Button>
            <Button className="flex-1" onClick={install}>
              <Download className="size-4" /> {t("install_now")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
