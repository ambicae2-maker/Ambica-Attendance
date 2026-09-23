/**
 * Invite a new admin (runs on Vercel's server, never in the browser).
 *
 * Only a super admin may call it. It adds the email to the `admins` allow-list and
 * emails an invitation link; the person then sets their own password.
 *
 * Needs these Environment Variables on Vercel:
 *   SUPABASE_SERVICE_ROLE_KEY  – Supabase → Project Settings → API Keys → service_role (SECRET)
 *   VITE_SUPABASE_URL          – already set for the app
 */
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Server is not configured: add SUPABASE_SERVICE_ROLE_KEY in Vercel." });
  }

  const supabase = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Who is calling?
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Not signed in" });
  const { data: caller, error: callerError } = await supabase.auth.getUser(token);
  const callerEmail = caller?.user?.email?.toLowerCase();
  if (callerError || !callerEmail) return res.status(401).json({ error: "Not signed in" });

  // 2. Are they a super admin?
  const { data: me } = await supabase.from("admins").select("active, is_super").eq("email", callerEmail).maybeSingle();
  if (!me?.active || !me.is_super) return res.status(403).json({ error: "Only a super admin can add admins" });

  // 3. Validate input
  const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {})) as {
    email?: string;
    name?: string;
    redirectTo?: string;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const redirectTo = body.redirectTo;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address" });

  // 4. Allow-list the email (so the invite actually grants access)
  const { error: listError } = await supabase
    .from("admins")
    .upsert({ email, name, active: true, added_by: callerEmail }, { onConflict: "email" });
  if (listError) return res.status(500).json({ error: listError.message });

  // 5. Email the invitation. If they already have a login, send a set-password link instead.
  const invite = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (invite.error) {
    const already = /already|exists|registered/i.test(invite.error.message);
    if (!already) return res.status(502).json({ error: invite.error.message });
    const reset = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (reset.error) return res.status(502).json({ error: reset.error.message });
    return res.status(200).json({ ok: true, existing: true });
  }

  return res.status(200).json({ ok: true, existing: false });
}
