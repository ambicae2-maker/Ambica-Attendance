# Admin invitations + email (SMTP) setup

Do these once. After that, you (the super admin) add new admins from **Settings → Admins**,
they get an email, set their own password, and they're in. Nobody can create their own account.

---

## 1. Database: make yourself super admin

Supabase → **SQL Editor** → new query → paste the contents of
[`supabase/02-super-admin.sql`](supabase/02-super-admin.sql) → **Run**.

The last line shows your email with `is_super = true`.

---

## 2. Gmail: create an App Password

Gmail does not accept your normal password for SMTP. You need a 16-character App Password.

1. Go to **myaccount.google.com/security** (signed in as `ambicae2@gmail.com`).
2. Turn on **2-Step Verification** if it isn't already (required).
3. Go to **myaccount.google.com/apppasswords**.
4. App name: `Ambica Attendance` → **Create**.
5. Copy the 16-character password shown, e.g. `abcd efgh ijkl mnop`. Spaces don't matter.

---

## 3. Supabase: turn on custom SMTP

Supabase → **Authentication** → **Emails** → **SMTP Settings** → enable **Custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `ambicae2@gmail.com` |
| Sender name | `Ambica Enterprise` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `ambicae2@gmail.com` |
| Password | the 16-character App Password from step 2 |

**Save**. Then open **Authentication → Rate Limits** and raise
**"Emails sent per hour"** (30 is plenty). The old 2-per-hour limit is what blocked you before.

Gmail allows roughly 500 emails a day, far more than this app needs.

---

## 4. Supabase: block self sign-up

**Authentication → Sign In / Providers → Email**:
- **Allow new users to sign up:** OFF
- **Confirm email:** ON (invited people confirm by clicking the invite link)

Invitations still work, because the server sends them as an administrator.

---

## 5. Supabase: allow the live links

**Authentication → URL Configuration**:
- **Site URL:** `https://ambica-attendance-tau.vercel.app`
- **Redirect URLs:** add `https://ambica-attendance-tau.vercel.app/**` and `http://localhost:5173/**`

---

## 6. Vercel: add the server key

The invitation is sent by `/api/invite-admin`, which runs on Vercel's server and needs
Supabase's **secret** key. It is never sent to any browser.

1. Supabase → **Project Settings → API Keys** → copy the **`service_role`** key (marked secret).
2. Vercel → your project → **Settings → Environment Variables** → **Add**:

   | Name | Value | Environments |
   |---|---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key | Production, Preview, Development |

3. Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are also there (from the first deploy).
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new key is picked up.

> Never put the `service_role` key in `.env` in this project or anywhere in the app code.
> It bypasses every security rule.

---

## How adding an admin works now

1. You sign in and open **Settings → Admins → Add** (only super admins see this button).
2. Type their name and email → **Send invitation**.
3. They get an email from `ambicae2@gmail.com` with a link.
4. The link opens the app on the **Set password** page; they choose a password.
5. They're signed in, and can use everything except adding or removing admins.

If someone forgets their password, they use **Forgot password?** on the sign-in page, which
also goes through your Gmail now.

**Note:** inviting works on the live website only (it needs the server function),
not on the local `npm run dev` preview.
