/* End-to-end UI test. Drives the real screens in Edge against sample data.
   Run:  npx vite --mode test --port 5199 --strictPort     (in one terminal)
         node scripts/ui-test.mjs                          (in another)
   The test env points Supabase at a dead address, so nothing touches real data. */
import { chromium } from "playwright-core";

const BASE = process.env.UI_TEST_BASE ?? "http://localhost:5199/ui-test.html";
const shots = process.env.UI_TEST_SHOTS ?? null;

let pass = 0;
const fails = [];
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log("  ok   " + name);
  } else {
    fails.push(`${name}${got === undefined ? "" : ` — got ${JSON.stringify(got)}`}`);
    console.log("  FAIL " + name + (got === undefined ? "" : ` — got ${JSON.stringify(got)}`));
  }
};
const money = (t) => Number(String(t).replace(/[^\d]/g, ""));
const liveAmount = async (page) => {
  const el = page.getByTestId("live-amount").first();
  await el.waitFor();
  return Number(await el.getAttribute("data-value"));
};
const tileCount = async (page, status) => Number(await page.getByTestId("tile-" + status).first().getAttribute("data-count"));

// Same rules as src/lib/payroll.ts, recomputed independently for comparison.
const today = new Date();
const y = today.getFullYear();
const m = today.getMonth();
const daysInMonth = new Date(y, m + 1, 0).getDate();
const dayOfMonth = today.getDate();
const SALARY_A = 30000;
const rateA = SALARY_A / daysInMonth;
const expectedNetA = Math.round(rateA * (dayOfMonth - 1)); // one absent day (the 3rd)

async function run() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  ctx.on("weberror", (e) => errors.push(String(e.error())));

  const open = async (route) => {
    const page = await ctx.newPage();
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !/Failed to fetch|ERR_|NetworkError|net::/i.test(t)) errors.push(t + " @ " + (msg.location().url || "?"));
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}?r=${encodeURIComponent(route)}`, { waitUntil: "networkidle" });
    return page;
  };
  const shot = async (page, name) => {
    if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
  };
  const noOverflow = async (page, name) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`${name}: no sideways scrolling`, over <= 1, over);
  };

  // ── 1. Dashboard ──────────────────────────────────────────
  {
    const page = await open("/admin");
    await page.getByText("Ramesh Patel").first().waitFor();
    ok("dashboard lists active drivers", await page.getByText("Suresh Yadav").first().isVisible());
    ok("dashboard hides drivers who left", !(await page.getByText("Mahesh Chauhan").first().isVisible().catch(() => false)));
    const active = await page.locator("text=Active drivers").locator("xpath=..").innerText();
    ok("active driver count = 2", /\b2\b/.test(active), active);
    const card = page.locator("a[href='/admin/drivers/d-a']");
    const amount = money(await card.locator(".tabular").first().innerText());
    ok(`dashboard shows Ramesh net ${expectedNetA}`, amount === expectedNetA, amount);
    await noOverflow(page, "dashboard");
    await shot(page, "01-dashboard");
    await page.close();
  }

  // ── 2. Driver profile numbers ─────────────────────────────
  {
    const page = await open("/admin/drivers/d-a");
    await page.getByText("Salary breakdown").waitFor();
    const net = await liveAmount(page);
    ok(`profile net = dashboard net (${expectedNetA})`, net === expectedNetA, net);

    const breakdown = await page.locator("text=Salary breakdown").locator("xpath=../..").innerText();
    const nums = breakdown.match(/₹[\d,]+/g).map(money);
    ok("breakdown shows monthly salary", nums.includes(SALARY_A), nums.slice(0, 4));
    ok("breakdown shows one absent day deduction", nums.includes(Math.round(rateA)), Math.round(rateA));

    const absentTile = await tileCount(page, "absent");
    ok("one absent day counted", absentTile === 1, absentTile);
    await noOverflow(page, "profile");
    await shot(page, "02-profile");
    await page.close();
  }

  // ── 3. Marking a day changes the salary immediately ───────
  {
    const page = await open("/admin/drivers/d-a");
    await page.getByRole("heading", { name: "Attendance", exact: true }).waitFor();
    const netBefore = await liveAmount(page);

    // open day 10 of this month and mark Absent
    await page.getByRole("button", { name: "10", exact: true }).first().click();
    await page.getByRole("dialog").waitFor();
    ok("day sheet opens", await page.getByRole("dialog").isVisible());

    // dialog spacing: the Save button must not touch the bottom edge
    const dialog = await page.getByRole("dialog").boundingBox();
    const saveBtn = await page.getByRole("dialog").getByRole("button", { name: /^Save$/ }).boundingBox();
    const gap = dialog.y + dialog.height - (saveBtn.y + saveBtn.height);
    ok("dialog button has bottom spacing (>=16px)", gap >= 16, Math.round(gap));

    await page.getByRole("dialog").getByRole("button", { name: "Absent" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Save$/ }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });

    await page.waitForFunction(
      (b) => Number(document.querySelector('[data-testid="live-amount"]').getAttribute("data-value")) !== b,
      netBefore,
      { timeout: 5000 },
    );
    const netAfter = await liveAmount(page);
    ok(`marking absent cuts one day (${Math.round(rateA)})`, netBefore - netAfter === Math.round(rateA), {
      netBefore,
      netAfter,
      diff: netBefore - netAfter,
    });

    // undo: set it back to Present
    await page.getByRole("button", { name: "10", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Present" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Save$/ }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForTimeout(400);
    const netBack = await liveAmount(page);
    ok("setting back to Present restores the pay", netBack === netBefore, { netBack, netBefore });
    await shot(page, "03-after-marking");
    await page.close();
  }

  // ── 4. Offline behaviour: change is queued, not lost ──────
  {
    const page = await open("/admin/drivers/d-a");
    await page.getByRole("heading", { name: "Attendance", exact: true }).waitFor();
    const badge = await page.locator("header").innerText();
    ok("offline/sync badge is shown when the server is unreachable", /Offline|\d/.test(badge), badge);
    await page.close();
  }

  // ── 5. Today screen ───────────────────────────────────────
  {
    const page = await open("/admin/today");
    await page.getByText("Mark attendance").waitFor();
    const rows = await page.locator("a[href^='/admin/drivers/']").count();
    ok("today lists both working drivers", rows === 2, rows);

    const before = await tileCount(page, "present");
    await page.locator("button[aria-label='Absent']").first().click();
    await page.waitForTimeout(400);
    const after = await tileCount(page, "present");
    ok("marking absent updates the counts", after === before - 1, { before, after });
    await noOverflow(page, "today");
    await shot(page, "04-today");
    await page.close();
  }

  // ── 6. Driver's own screen ────────────────────────────────
  {
    const page = await open("/me");
    await page.getByText("Ramesh Patel").first().waitFor();
    const shown = await liveAmount(page);
    ok(`driver sees the same salary (${expectedNetA})`, shown === expectedNetA, shown);
    ok("driver sees no Edit button", (await page.getByRole("button", { name: "Edit" }).count()) === 0);
    ok("driver sees no Add payment button", (await page.getByText("Add payment").count()) === 0);
    await noOverflow(page, "driver page");
    await shot(page, "05-driver");
    await page.close();
  }

  // ── 7. Languages ──────────────────────────────────────────
  {
    const page = await open("/me");
    await page.getByText("Ramesh Patel").first().waitFor();
    await page.getByRole("button", { name: "ગુ" }).click();
    await page.waitForTimeout(300);
    ok("switches to Gujarati", (await page.getByText("તમારી હાજરી").count()) > 0);
    await page.getByRole("button", { name: "हि" }).click();
    await page.waitForTimeout(300);
    ok("switches to Hindi", (await page.getByText("आपकी हाज़िरी").count()) > 0);
    await shot(page, "06-gujarati");
    await page.getByRole("button", { name: "EN" }).click(); // back to English for the next tests
    await page.waitForTimeout(200);
    await page.close();
  }

  // ── 8. Add-driver form validation ─────────────────────────
  {
    const page = await open("/admin/drivers/new");
    await page.getByText("New driver").waitFor();
    await page.getByRole("button", { name: /Add driver/ }).click();
    await page.waitForTimeout(300);
    ok("empty form shows name error", (await page.getByText("Enter the driver's name").count()) > 0);
    ok("empty form shows salary error", (await page.getByText("Enter a monthly salary").count()) > 0);
    await noOverflow(page, "driver form");
    await page.close();
  }

  // ── 9. Other screens load without errors ──────────────────
  for (const [route, text] of [
    ["/admin/holidays", "Company holidays"],
    ["/admin/settings", "Company details"],
    ["/admin/drivers/d-a/edit", "Edit driver"],
  ]) {
    const page = await open(route);
    await page.getByText(text).first().waitFor({ timeout: 8000 });
    ok(`${route} opens`, true);
    await noOverflow(page, route);
    await page.close();
  }

  // ── 10. Desktop layout ────────────────────────────────────
  {
    const wide = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await wide.newPage();
    await page.goto(`${BASE}?r=/admin/drivers/d-a`, { waitUntil: "networkidle" });
    await page.getByText("Salary breakdown").waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok("desktop: no sideways scrolling", over <= 1, over);
    if (shots) await page.screenshot({ path: `${shots}/07-desktop.png`, fullPage: true });
    await wide.close();
  }

  ok("no JavaScript errors anywhere", errors.length === 0, errors.slice(0, 5));

  await browser.close();
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    console.log("\nFAILURES:");
    fails.forEach((f) => console.log(" ✗ " + f));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
