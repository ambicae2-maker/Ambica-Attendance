import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { loadPortal, NotFoundError } from "@/lib/store";
import { errorMessage } from "@/lib/utils";
import { Button, Spinner } from "@/components/ui";

/**
 * The driver's private link: /d/<token>
 * Opens their page straight away — no ID to type. The token is remembered on the
 * device, so next time they just open the app.
 */
export default function OpenLink() {
  const { token = "" } = useParams();
  const { t } = useI18n();
  const { setDriverCode } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPortal(token)
      .then((data) => {
        if (!alive) return;
        qc.setQueryData(["portal", token], data);
        setDriverCode(token);
        setDone(true);
      })
      .catch((e) => alive && setError(e instanceof NotFoundError ? t("link_invalid") : errorMessage(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (done) return <Navigate to="/me" replace />;

  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-6 text-center text-ink-foreground">
      <div className="max-w-sm">
        <img src="/logo-white.png" alt="Ambica Enterprise" className="mx-auto h-16 w-auto" />
        {error ? (
          <>
            <p className="mt-6 text-white/80">{error}</p>
            <Button className="mt-5" onClick={() => location.reload()}>
              {t("retry")}
            </Button>
          </>
        ) : (
          <>
            <Spinner className="mx-auto mt-8 text-gold" />
            <p className="mt-4 text-white/70">{t("opening")}</p>
          </>
        )}
      </div>
    </div>
  );
}
