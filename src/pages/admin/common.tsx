import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useI18n, type TFn } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { Button, EmptyState } from "@/components/ui";

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<AlertTriangle className="size-8" />}
      title={t("something_wrong")}
      sub={errorMessage(error)}
      action={<Button onClick={onRetry}>{t("retry")}</Button>}
    />
  );
}

/** Tell the user whether a change reached the server or was saved offline. */
export function notifySaved(t: TFn, synced: boolean, message?: string) {
  if (synced) toast.success(message ?? t("saved"));
  else toast(message ?? t("saved"), { description: t("offline_saved") });
}
