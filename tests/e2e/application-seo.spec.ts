import { expect, test } from "@playwright/test";
import { adminLogin, createBusinessViaAdmin, resetLoginLimits } from "./helpers";

test("başvuru: ana sayfadan form → yönetici onayı → işletme girişi", async ({ page, browser }, testInfo) => {
  test.setTimeout(150_000);
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const g = await browser.newContext({ ...testInfo.project.use, extraHTTPHeaders: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
  const gp = await g.newPage();
  await gp.goto("/");
  await gp.getByRole("link", { name: "İşletmeni ekle" }).last().click();
  await expect(gp).toHaveURL(/\/basvuru$/);
  await expect(gp.getByRole("heading", { level: 1 })).toContainText("İşletmenizi");
  await gp.waitForLoadState("networkidle");

  // Günlük fiyat: yıllık 3.490 ₺ ≈ 10 ₺/gün, aylık 349,90 ₺ ≈ 12 ₺/gün
  await expect(gp.getByText("≈₺10", { exact: true })).toBeVisible();
  await gp.getByRole("radio", { name: "Aylık", exact: true }).click();
  await expect(gp.getByText("≈₺12", { exact: true })).toBeVisible();
  await expect(gp.getByText("Fiyatlara KDV dahildir", { exact: false })).toBeVisible();
  await gp.getByRole("radio", { name: /Havale/ }).check();
  await gp.getByLabel("İşletme adı").fill(`Uzak Berber ${suffix}`);
  await gp.getByLabel("Çalışan sayısı").fill("3");
  await gp.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "Trabzon" });
  await gp.getByRole("combobox", { name: "İlçe" }).selectOption({ label: "Ortahisar" });
  await gp.getByLabel("Açık adres").fill("Kemerkaya Mah. Uzun Sok. No:7");
  await gp.getByLabel("Ad soyad").fill("Hasan Usta");
  await gp.getByLabel("Telefon").fill(`0532${String(Date.now()).slice(-7)}`);
  await gp.getByLabel("E-posta").fill(`uzak-${suffix}@test.local`);
  await gp.getByRole("button", { name: "Başvuruyu gönder" }).click();
  await expect(gp.getByText("KVKK", { exact: false }).or(gp.getByText("aydınlatma metnini onaylayın"))).toBeVisible();
  await gp.getByRole("checkbox").check();
  await gp.getByRole("button", { name: "Başvuruyu gönder" }).click();
  await expect(gp.getByRole("heading", { name: "Başvurunuz alındı" })).toBeVisible({ timeout: 20_000 });
  await g.close();

  await adminLogin(page);
  await page.goto("/admin/basvurular");
  const card = page.locator("li", { hasText: `Uzak Berber ${suffix}` });
  await expect(card.getByText("Ortahisar, Trabzon")).toBeVisible();
  await expect(card.getByText(/Aylık · Havale \/ EFT/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Onayla ve işletmeyi oluştur" }).click();
  await expect(card.getByText("İşletme oluşturuldu")).toBeVisible({ timeout: 20_000 });
  const login = (await card.locator("b.font-mono").first().textContent())!.trim();
  const temp = (await card.getByTestId("temp-password").textContent())!.trim();

  await resetLoginLimits();
  const b = await browser.newContext({ ...testInfo.project.use });
  const bp = await b.newPage();
  await bp.goto("/isletme");
  await bp.getByLabel("E-posta veya kullanıcı adı").fill(login);
  await bp.getByLabel("Şifre").fill(temp);
  await bp.getByRole("button", { name: "Giriş yap" }).click();
  await expect(bp).toHaveURL(/\/isletme\/sifre-degistir$/);
  await b.close();
});

test("SEO: başlık etiketleri, yapılandırılmış veri, şehir sayfaları, site haritası", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og\.png/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "tr_TR");
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join(" ")).toContain('"SearchAction"');

  const city = await request.get("/berberler/istanbul");
  expect(city.status()).toBe(200);
  await page.goto("/berberler/istanbul");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("İstanbul Berberleri ve Online Randevu");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/berberler\/istanbul$/);
  expect((await request.get("/berberler/olmayan-il")).status()).toBe(404);

  await page.goto("/ara?q=deneme");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const sm = await (await request.get("/sitemap.xml")).text();
  expect(sm).toContain("/basvuru");
  expect(sm).toContain("/fiyatlandirma");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap:");
});

test("üst menü: Müşteri Girişi, Müşteri Kayıt, İşletme Girişi; işletme e-postayla giriş yapar", async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Site menüsü" });
  await expect(nav.getByRole("link", { name: "Müşteri Girişi" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Müşteri Kayıt" })).toBeVisible();
  await nav.getByRole("link", { name: "İşletme Girişi" }).click();
  await expect(page).toHaveURL(/\/isletme$/);
  await expect(page.getByLabel("E-posta veya kullanıcı adı")).toBeVisible();

  // Yönetici işletme oluşturur; işletme e-postasıyla giriş
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const login = `eposta-${suffix}`;
  await adminLogin(page);
  const { tempPassword } = await createBusinessViaAdmin(page, `E-posta Berber ${suffix}`, login);
  await resetLoginLimits();
  const b = await browser.newContext({ ...testInfo.project.use });
  const bp = await b.newPage();
  await bp.goto("/");
  await bp.getByRole("navigation", { name: "Site menüsü" }).getByRole("link", { name: "İşletme Girişi" }).click();
  await bp.getByLabel("E-posta veya kullanıcı adı").fill(`${login}@test.local`);
  await bp.getByLabel("Şifre").fill(tempPassword);
  await bp.getByRole("button", { name: "Giriş yap" }).click();
  await expect(bp).toHaveURL(/\/isletme\/sifre-degistir$/);
  await b.close();
});

test("fiyatlandırma: ana sayfa butonu → aylık, yıllık, tek seferlik → başvuruda seçili gelir", async ({ page }) => {
  await page.goto("/");
  await page.locator("main").getByRole("link", { name: "Fiyatlandırma" }).click();
  await expect(page).toHaveURL(/\/fiyatlandirma$/);
  await expect(page.getByRole("heading", { level: 2, name: "Aylık" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Yıllık" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Tek seferlik" })).toBeVisible();
  await expect(page.getByText("₺14.999", { exact: true })).toBeVisible();
  await expect(page.getByText(/fotoğraf çekim/i)).toHaveCount(0);
  await expect(page.getByText("KDV dahil", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/havale \/ EFT/i)).toBeVisible();

  await page.getByRole("link", { name: "Tek seferlik ile başvur" }).click();
  await expect(page).toHaveURL(/\/basvuru\?donem=tek-seferlik$/);
  await expect(page.getByRole("radio", { name: "Tek seferlik" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("bir kez", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/dükkan çekimi/i)).toHaveCount(0);
});
