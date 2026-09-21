/**
 * One app, two kinds of sign-in:
 *  - Admin: Supabase email + password. Access is granted only if the email is in `admins`.
 *  - Driver: just their Driver ID, remembered on the device. Read-only.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { del } from "idb-keyval";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "./supabase";
import { normalizeCode } from "./utils";

const DRIVER_KEY = "driver_code";
const adminCacheKey = (email: string) => `admin_ok:${email.toLowerCase()}`;
export const QUERY_CACHE_KEY = "rq-cache-v1";

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  isAdmin: boolean;
  driverCode: string | null;
  setDriverCode: (code: string | null) => void;
  signOut: () => Promise<void>;
  recheckAdmin: () => Promise<boolean>;
}

const Ctx = createContext<AuthCtx | null>(null);

function readStore(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

async function checkAdmin(session: Session | null): Promise<boolean> {
  const email = session?.user.email;
  if (!email) return false;
  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) throw error;
    writeStore(adminCacheKey(email), data ? "1" : null);
    return Boolean(data);
  } catch {
    // Offline: trust the last known answer for this email.
    return readStore(adminCacheKey(email)) === "1";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [driverCode, setDriverCodeState] = useState<string | null>(() => readStore(DRIVER_KEY));

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const admin = await checkAdmin(data.session);
      if (!alive) return;
      setSession(data.session);
      setIsAdmin(admin);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Defer: calling Supabase inside this callback can deadlock the auth lock.
        setTimeout(() => void checkAdmin(s).then(setIsAdmin), 0);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setDriverCode = (code: string | null) => {
    const c = code ? normalizeCode(code) : null;
    writeStore(DRIVER_KEY, c);
    setDriverCodeState(c);
  };

  const signOut = async () => {
    if (session) await supabase.auth.signOut().catch(() => undefined);
    setDriverCode(null);
    setIsAdmin(false);
    qc.clear();
    await del(QUERY_CACHE_KEY).catch(() => undefined);
  };

  const recheckAdmin = async () => {
    const { data } = await supabase.auth.getSession();
    const ok = await checkAdmin(data.session);
    setSession(data.session);
    setIsAdmin(ok);
    return ok;
  };

  return (
    <Ctx.Provider value={{ loading, session, isAdmin, driverCode, setDriverCode, signOut, recheckAdmin }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
