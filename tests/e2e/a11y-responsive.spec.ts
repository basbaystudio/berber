import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { adminLogin, businessFirstLogin, createBusinessViaAdmin } from "./helpers";

/**
 * Erişilebilirlik (axe-core, WCAG 2.1 AA) ve duyarlı yerleşim taraması.
 * Her projede (masaüstü, tablet, mobil) ana sayfaların ciddi/kritik ihlali olmamalı ve yatay taşma olmamalı.
 */

const DB = process.env.E2E_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_e2e";

async function publish(login: string) {
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query("select b.id, b.slug from business_users u join businesses b on b.id = u.business_id where u.login = $1", [login]);
    const { id: bid, slug } = rows[0] as { id: string; slug: string };
    for (let d = 1; d <= 7; d++) await pool.query("insert into business_hours (business_id, weekday, start_time, end_time) values ($1,$2,'09:00','21:00')", [bid, d]);
    const st = await pool.query("insert into staff (business_id, name, title) values ($1, 'Mehmet Usta', 'Usta berber') returning id", [bid]);
    for (let d = 1; d <= 7; d++) await pool.query("insert into staff_shifts (business_id, staff_id, weekday, start_time, end_time) values ($1,$2,$3,'09:00','21:00')", [bid, st.rows[0].id, d]);
    const sv = await pool.query("insert into services (business_id, name, price_kurus, duration_min) values ($1,'Saç Kesimi',45000,30) returning id", [bid]);
    await pool.query("insert into staff_services (business_id, staff_id, service_id) values ($1,$2,$3)", [bid, st.rows[0].id, sv.rows[0].id]);
    await pool.query("update businesses set status = 'ACTIVE', min_price_kurus = 45000, is_published = true, published_at = now() where id = $1", [bid]);
    return slug;
  } finally {
    await pool.end();
  }
}

async function check(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Harita karoları üçüncü taraf içerik
    .exclude(".leaflet-container")
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${path} · ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect.soft(serious, serious.join("\n")).toEqual([]);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(overflow, `${path} yatay taşma: ${overflow}px`).toBeLessThanOrEqual(1);
}

test("erişilebilirlik ve duyarlı yerleşim: herkese açık sayfalar, işletme ve yönetici panelleri", async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const login = `a11y-${suffix}`;

  await adminLogin(page);
  const { tempPassword } = await createBusinessViaAdmin(page, `Erişim Berber ${suffix}`, login);
  const slug = await publish(login);

  for (const p of ["/admin", "/admin/isletmeler", "/admin/abonelikler", "/admin/belgeler", "/admin/yorumlar", "/admin/ayarlar"]) {
    await check(page, p);
  }

  const { ctx, bp } = await businessFirstLogin(browser, testInfo, login, tempPassword);
  for (const p of [
    "/isletme/panel",
    "/isletme/panel/takvim",
    "/isletme/panel/randevular",
    "/isletme/panel/calisma-saatleri",
    "/isletme/panel/hizmetler",
    "/isletme/panel/abonelik",
    "/isletme/panel/dukkan-fotograflari",
    "/isletme/panel/belgeler",
  ]) {
    await check(bp, p);
  }
  await ctx.close();

  const guest = await browser.newContext({ ...testInfo.project.use });
  const gp = await guest.newPage();
  for (const p of ["/", "/ara", `/berber/${slug}`, `/berber/${slug}/randevu`, "/giris", "/kayit", "/sifremi-unuttum", "/admin", "/isletme", "/kvkk-aydinlatma"]) {
    await check(gp, p);
  }
  await guest.close();
});
