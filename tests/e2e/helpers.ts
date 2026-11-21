import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { Pool } from "pg";
import { E2E_ADMIN } from "./global-setup";

const DB = process.env.E2E_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_e2e";

/**
 * Testlerin hepsi aynı IP'den çok sayıda giriş yapar; uygulamanın giriş sınırı (15 dakikada 20) doğru çalışıp
 * sonraki testleri engellemesin diye giriş sayaçları sıfırlanır. Yalnızca test veritabanında.
 */
export async function resetLoginLimits() {
  const pool = new Pool({ connectionString: DB });
  try {
    await pool.query("delete from rate_limits where key like 'login:%'");
  } finally {
    await pool.end();
  }
}

export async function adminLogin(page: Page) {
  await resetLoginLimits();
  await page.goto("/admin");
  await page.getByLabel("E-posta").fill(E2E_ADMIN.email);
  await page.getByLabel("Şifre").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Gösterge Paneli" })).toBeVisible();
}

/** Admin arayüzünden işletme oluşturur, geçici şifreyi döner. */
export async function createBusinessViaAdmin(page: Page, name: string, login: string) {
  await page.goto("/admin/isletmeler/yeni");
  await page.getByLabel("İşletme adı").fill(name);
  await page.getByLabel("Telefon").fill("0532 123 45 67");
  await page.getByLabel("E-posta").fill(`${login}@test.local`);
  await page.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "İstanbul" });
  await page.getByRole("combobox", { name: "İlçe" }).selectOption({ label: "Kadıköy" });
  await page.getByLabel("Açık adres").fill("Caferağa Mah. Moda Cad. No:10");
  await page.getByLabel("Enlem").fill("40.987");
  await page.getByLabel("Boylam").fill("29.027");
  await page.getByLabel("Yetkili adı soyadı").fill("Ahmet Usta");
  await page.getByLabel("Kullanıcı adı").fill(login);
  await page.getByRole("button", { name: "İşletmeyi oluştur" }).click();
  await expect(page.getByText("İşletme oluşturuldu", { exact: true })).toBeVisible();
  const tempPassword = (await page.getByTestId("temp-password").textContent())!.trim();
  await page.getByRole("link", { name: "İşletme detayına git" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return { tempPassword, detailUrl: page.url() };
}

/** İşletme olarak giriş yapar ve zorunlu şifre değişimini tamamlar. */
export async function businessFirstLogin(browser: Browser, testInfo: TestInfo, login: string, tempPassword: string, newPassword = "Makas2026kesim") {
  await resetLoginLimits();
  const ctx = await browser.newContext({ ...testInfo.project.use });
  const bp = await ctx.newPage();
  await bp.goto("/isletme");
  await bp.getByLabel("Kullanıcı adı").fill(login);
  await bp.getByLabel("Şifre").fill(tempPassword);
  await bp.getByRole("button", { name: "Giriş yap" }).click();
  await expect(bp).toHaveURL(/\/isletme\/sifre-degistir$/);
  await bp.getByLabel("Mevcut (geçici) şifre").fill(tempPassword);
  await bp.locator("#newPassword").fill(newPassword);
  await bp.getByLabel("Yeni şifre (tekrar)").fill(newPassword);
  await bp.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await expect(bp).toHaveURL(/\/isletme\/panel/);
  return { ctx, bp };
}
