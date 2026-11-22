import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { adminLogin, businessFirstLogin, createBusinessViaAdmin } from "./helpers";

const DB = process.env.E2E_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_e2e";

async function publish(login: string) {
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query("select b.id, b.slug from business_users u join businesses b on b.id = u.business_id where u.login = $1", [login]);
    const { id: bid, slug } = rows[0] as { id: string; slug: string };
    await pool.query("insert into business_hours (business_id, weekday, start_time, end_time) values ($1, 1, '09:00', '18:00')", [bid]);
    const st = await pool.query("insert into staff (business_id, name) values ($1, 'Usta') returning id", [bid]);
    const sv = await pool.query("insert into services (business_id, name, price_kurus, duration_min) values ($1,'Kesim',40000,30) returning id", [bid]);
    await pool.query("insert into staff_services (business_id, staff_id, service_id) values ($1,$2,$3)", [bid, st.rows[0].id, sv.rows[0].id]);
    await pool.query("update businesses set status='ACTIVE', is_published=true, published_at=now() where id=$1", [bid]);
    return slug;
  } finally {
    await pool.end();
  }
}

test("dükkan fotoğrafları: yönetici dış cephe, işletme iç mekân ekler; profilde Dükkan bölümünde görünür", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const login = `dukkan-${suffix}`;
  fs.mkdirSync("test-results", { recursive: true });
  const dis = path.resolve("test-results", `dis-${testInfo.project.name}.png`);
  const ic = path.resolve("test-results", `ic-${testInfo.project.name}.png`);
  await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 30, g: 60, b: 90 } } }).png().toFile(dis);
  await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 120, g: 90, b: 60 } } }).png().toFile(ic);

  await adminLogin(page);
  const { tempPassword, detailUrl } = await createBusinessViaAdmin(page, `Dükkan Berber ${suffix}`, login);
  await page.goto(detailUrl);
  await page.waitForLoadState("networkidle");
  await page.locator("label", { hasText: "Dış cephe fotoğrafı ekle" }).locator('input[type="file"]').setInputFiles(dis);
  await expect(page.getByText("1 fotoğraf yüklendi.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("1/20 fotoğraf")).toBeVisible();

  const { ctx, bp } = await businessFirstLogin(browser, testInfo, login, tempPassword);
  await bp.goto("/isletme/panel/dukkan-fotograflari");
  await bp.waitForLoadState("networkidle");
  await expect(bp.getByRole("img", { name: "Dış cephe" })).toBeVisible(); // yöneticinin yüklediği
  await bp.locator("label", { hasText: "İç mekân fotoğrafı ekle" }).locator('input[type="file"]').setInputFiles(ic);
  await expect(bp.getByText("1 fotoğraf yüklendi.")).toBeVisible({ timeout: 30_000 });
  await expect(bp.getByText("2/20 fotoğraf")).toBeVisible();
  await ctx.close();

  const slug = await publish(login);
  await page.goto(`/berber/${slug}`);
  const section = page.locator("section#dukkan");
  await expect(section.getByRole("heading", { name: "Dükkan" })).toBeVisible();
  await expect(section.getByRole("button", { name: "Dış cephe" })).toBeVisible();
  await expect(section.getByRole("button", { name: "İç mekân" })).toBeVisible();
  await expect(section.locator("img")).toHaveCount(2);
});
