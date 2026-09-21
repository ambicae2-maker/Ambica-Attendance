import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

function read(): ThemePref {
  try {
    const v = localStorage.getItem("theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

export function applyTheme(pref: ThemePref = read()) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(read);
  useEffect(() => {
    applyTheme(pref);
    if (pref !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref]);
  return [
    pref,
    (p) => {
      setPref(p);
      try {
        localStorage.setItem("theme", p);
      } catch {
        /* ignore */
      }
    },
  ];
}
