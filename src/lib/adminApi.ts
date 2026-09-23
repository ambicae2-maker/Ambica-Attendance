import { supabase } from "./supabase";

/**
 * Ask the server to invite a new admin by email.
 * The heavy lifting happens in /api/invite-admin so the secret key stays on the server.
 */
export async function inviteAdmin(email: string, name: string): Promise<{ existing: boolean }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch("/api/invite-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, name, redirectTo: `${location.origin}/reset` }),
  });

  const text = await res.text();
  let payload: { error?: string; existing?: boolean } = {};
  try {
    payload = JSON.parse(text);
  } catch {
    // Running `npm run dev` locally: /api only exists on Vercel, so we get the HTML page back.
    throw new Error("Inviting admins works on the live website (Vercel), not on this local preview.");
  }
  if (!res.ok) throw new Error(payload.error ?? "Could not send the invitation");
  return { existing: Boolean(payload.existing) };
}
