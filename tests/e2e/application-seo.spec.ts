import { expect, test } from "@playwright/test";
import { adminLogin, resetLoginLimits } from "./helpers";

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

  await gp.getByRole("radio", { name: "Aylık", exact: true }).click();
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
  await expect(card.getByText(/Aylık/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Onayla ve işletmeyi oluştur" }).click();
  await expect(card.getByText("İşletme oluşturuldu")).toBeVisible({ timeout: 20_000 });
  const login = (await card.locator("b.font-mono").first().textContent())!.trim();
  const temp = (await card.getByTestId("temp-password").textContent())!.trim();

  await resetLoginLimits();
  const b = await browser.newContext({ ...testInfo.project.use });
  const bp = await b.newPage();
  await bp.goto("/isletme");
  await bp.getByLabel("Kullanıcı adı").fill(login);
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
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap:");
});
