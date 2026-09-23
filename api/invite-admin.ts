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
// Where the invite link points. Set SITE_URL in Vercel for a custom domain.
const SITE_URL = (process.env.SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").replace(/\/+$/, "");

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
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address" });

  // The link is built here, never taken from the request, so it cannot be pointed elsewhere.
  const host = SITE_URL || `https://${req.headers.host ?? ""}`;
  const redirectTo = `${host.startsWith("http") ? host : "https://" + host}/reset`;

  // 4. Send the invitation first. If they already have a login, send a set-password link.
  let existing = false;
  const invite = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (invite.error) {
    if (!/already|exists|registered/i.test(invite.error.message)) {
      return res.status(502).json({ error: invite.error.message });
    }
    existing = true;
    const reset = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (reset.error) return res.status(502).json({ error: reset.error.message });
  }

  // 5. Only now grant access. Re-inviting a removed admin does not silently re-enable them.
  const { data: current } = await supabase.from("admins").select("email, active").eq("email", email).maybeSingle();
  const row: Record<string, unknown> = { email, name, added_by: callerEmail };
  if (!current) row.active = true; // only a brand-new admin is switched on here
  const { error: listError } = await supabase.from("admins").upsert(row, { onConflict: "email" });
  if (listError) return res.status(500).json({ error: listError.message });

  return res.status(200).json({ ok: true, existing });
}
