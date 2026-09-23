# Ambica Attendance

Driver attendance and salary PWA for Ambica Enterprise. One app with two logins:
**Admin** (email + password) and **Driver** (Driver ID only, read-only view).

Stack: React 19 · Vite 8 · TypeScript 7 · Tailwind CSS 4 · Supabase · TanStack Query · vite-plugin-pwa.

## First-time setup (about 10 minutes)

### 1. Create the database
1. Open your project on [supabase.com](https://supabase.com/dashboard).
2. In the left menu, open **SQL Editor** and click **New query**.
3. Open [`supabase/schema.sql`](supabase/schema.sql), copy everything, paste it in, and click **Run**.
   You should see "Success. No rows returned".
4. In a new query, run this with **your own email** to make yourself the first admin:
   ```sql
   insert into public.admins (email, name) values ('you@example.com', 'Your Name');
   ```

### 2. Connect the app
1. In Supabase, open **Project Settings → API Keys** and copy the **Publishable key**
   (or the legacy **anon public** key).
2. Paste it into `.env` after `VITE_SUPABASE_ANON_KEY=`. The URL is already filled in.
   Never use the **secret** / **service_role** key here.

### 3. Set the sign-in links
In Supabase, open **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:5173` for now (change it to your real website address after you deploy)
- **Redirect URLs**: add `http://localhost:5173/**` (and later `https://your-domain/**`)

### 4. Run it
```bash
npm install
npm run dev
```
Open http://localhost:5173, go to **Admin → "First time? Create your password"**, use the email from step 1,
confirm the email Supabase sends you, then sign in.

## Admins and email

Admins cannot sign themselves up. A **super admin** invites them by email from **Settings → Admins**,
and they set their own password from the emailed link. One-time setup (Gmail SMTP, super-admin SQL,
Vercel server key) is in [SETUP-ADMINS-AND-EMAIL.md](SETUP-ADMINS-AND-EMAIL.md).

## Everyday use
- **Add driver**: photo (camera or gallery), name, truck, salary. A random Driver ID such as `AMB-K7Q2X9` is created.
  Give this ID to the driver so they can log in on the **Driver** tab.
- **Today**: every driver is Present by default. Tap only the drivers who are Absent (A), on a Half day (½) or on a Holiday (H).
- **Driver profile**: calendar, live salary, extras (bonus, allowance, overtime per hour or per day, deduction, advance),
  payments (Cash, UPI, Bank or Cheque with a reference), salary changes, and PDF downloads/sharing.
- **Lock month**: after paying salary, lock the month to freeze its numbers. Any admin can unlock it.
- **Holidays**: a company holiday is paid for all drivers. To give one driver a holiday, tap that day on their calendar.
- **Settings**: company details, logo and GST for the salary slip, pay day (default 5), admins, language, theme, activity log.

## Salary rules
Daily rate = monthly salary ÷ days in that month. Present and Holiday are paid in full, a Half day gets half pay,
and Absent gets nothing (every leave is unpaid). A salary change applies from its effective date. Advances are
recovered from salary, and anything left over carries to the next month. All the logic is in
[`src/lib/payroll.ts`](src/lib/payroll.ts).

## Changing colors
Every color lives in [`src/theme/tokens.css`](src/theme/tokens.css): brand red, gold, ink, and the attendance
status colors. Change a value there and it updates everywhere, including the PDFs.
If you change `--ink`, also update `THEME_COLOR` in `vite.config.ts` and the `theme-color` meta tag in `index.html`.

## Offline
The app caches everything on the phone. Admins can mark attendance, add payments and more while offline.
Changes are queued and synced automatically when the internet is back (the badge at the top shows the count).
Adding a new driver's photo also syncs later. Logging in for the first time needs internet.

## Deploy
`npm run build` creates `dist/`, which you can host on Vercel, Netlify or any static host (use an SPA fallback to `index.html`).
Then add the live URL to Supabase **Authentication → URL Configuration**.

## Icons
To regenerate the app icons from `assets-src/logo-1024.png`, run `npm run icons`.
