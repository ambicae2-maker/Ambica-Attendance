import { useEffect, useState } from "react";
import { todayISO } from "./dates";

/**
 * Today's date, kept up to date while the app stays open.
 * Without this, an app left open overnight would keep counting yesterday.
 */
export function useToday(): string {
  const [day, setDay] = useState(todayISO);
  useEffect(() => {
    const tick = () => setDay((d) => (todayISO() === d ? d : todayISO()));
    const timer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return day;
}
