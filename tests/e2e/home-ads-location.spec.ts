import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { adminLogin, createBusinessViaAdmin } from "./helpers";

const DB = process.env.E2E_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_e2e";

/** İşletmeyi yayına alır ve başka test işletmeleriyle karışmasın diye ayrı bir konuma (Sivas) taşır. */
async function publishAt(login: string, lat: number, lng: number) {
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query("select business_id from business_users where login = $1", [login]);
    const bid = rows[0].business_id as string;
    for (let d = 1; d <= 7; d++) await pool.query("insert into business_hours (business_id, weekday, start_time, end_time) values ($1,$2,'09:00','21:00')", [bid, d]);
    const st = await pool.query("insert into staff (business_id, name) values ($1, 'Usta') returning id", [bid]);
    const sv = await pool.query("insert into services (business_id, name, price_kurus, duration_min) values ($1,'Saç Kesimi',40000,30) returning id", [bid]);
    await pool.query("insert into staff_services (business_id, staff_id, service_id) values ($1,$2,$3)", [bid, st.rows[0].id, sv.rows[0].id]);
    await pool.query("update businesses set status='ACTIVE', is_published=true, published_at=now(), latitude=$2, longitude=$3, min_price_kurus=40000 where id=$1", [bid, lat, lng]);
  } finally {
    await pool.end();
  }
}

test("reklam alanı listelerin arasında görünür ve tıklama sayılır; konuma göre yakındaki berberler önerilir", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const login = `yakin-${suffix}`;
  const name = `Sivas Berber ${suffix}`;
  const lat = 39.7505 + (testInfo.project.name === "mobil" ? 0.01 : testInfo.project.name === "tablet" ? 0.02 : 0);
  const lng = 37.0150;

  fs.mkdirSync("test-results", { recursive: true });
  const img = path.resolve("test-results", `reklam-${testInfo.project.name}.png`);
  await sharp({ create: { width: 1600, height: 400, channels: 3, background: { r: 60, g: 50, b: 40 } } }).png().toFile(img);

  await adminLogin(page);
  await createBusinessViaAdmin(page, name, login);
  await publishAt(login, lat, lng);

  // Önceki testlerden kalan reklamları kapat (yalnızca bu testin reklamı yayında olsun)
  {
    const pool = new Pool({ connectionString: DB });
    await pool.query("update banners set is_active = false where placement = 'LISTING'");
    await pool.end();
  }
  // Reklam alanı (il hedefi yok → herkese)
  const adTitle = `Bayrama özel bakım seti ${suffix}`;
  await page.goto("/admin/bannerlar");
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').first().setInputFiles(img);
  await page.getByLabel("Gösterim yeri").first().selectOption("LISTING");
  await page.getByLabel("Başlık").first().fill(adTitle);
  await page.getByLabel("Bağlantı").first().fill("/ara?hizmet=sac-kesimi");
  await page.getByRole("button", { name: "Banner ekle" }).click();
  await expect(page.getByText("Banner eklendi.")).toBeVisible({ timeout: 20_000 });

  // Ziyaretçi: konum izni olan tarayıcı
  const ctx = await browser.newContext({ ...testInfo.project.use, geolocation: { latitude: lat, longitude: lng }, permissions: ["geolocation"] });
  const gp = await ctx.newPage();
  await gp.goto("/");
  await expect(gp.getByText("Yakınındaki berberleri görelim")).toBeVisible();
  const ad = gp.getByRole("link", { name: new RegExp(`^Reklam ${adTitle}`) });
  await expect(ad).toBeVisible();
  await expect(ad.getByText("Reklam", { exact: true })).toBeVisible();

  await gp.getByRole("button", { name: "Konumumu paylaş" }).click();
  const near = gp.locator("section", { has: gp.getByRole("heading", { name: "Yakınındaki berberler" }) });
  await expect(near).toBeVisible();
  await expect(near.getByText("Konumuna göre")).toBeVisible();
  await expect(near.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await expect(near.getByText(/\d+ m|\d+(,|\.)\d km/).first()).toBeVisible();

  // Aramada da konuma göre mesafe gösterilir
  await gp.goto("/ara");
  await expect(gp.getByRole("link", { name: new RegExp(name) })).toBeVisible();

  // Reklam tıklaması → hedef sayfa; yönetimde sayaç
  await gp.goto("/");
  await gp.getByRole("link", { name: new RegExp(`^Reklam ${adTitle}`) }).click();
  await expect(gp).toHaveURL(/\/ara\?hizmet=sac-kesimi/);
  await page.goto("/admin/bannerlar");
  await expect(page.locator("li", { hasText: adTitle }).getByText(/Reklam alanı · Tüm iller · 1 tıklama/)).toBeVisible();

  // Konumu unut
  await gp.goto("/");
  await gp.getByRole("button", { name: "Konumu unut" }).click();
  await expect(gp.getByText("Yakınındaki berberleri görelim")).toBeVisible();
  await ctx.close();
});
