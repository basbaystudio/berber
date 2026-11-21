import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString(36);

test("korumalı sayfalar oturumsuz açılamaz; giriş adresleri /admin ve /isletme", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Platform Yönetimi" })).toBeVisible();
  await page.goto("/admin/isletmeler");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/isletme/panel");
  await expect(page).toHaveURL(/\/isletme$/);
  await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
  // Eski adresler yeni adreslere yönlenir
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/isletme/giris");
  await expect(page).toHaveURL(/\/isletme$/);
});

test("sahte oturum çerezi reddedilir", async ({ page, context }) => {
  await page.goto("/admin");
  await page.evaluate(() => (document.cookie = `__Host-bp_a=${"x".repeat(43)}; Secure; Path=/`));
  expect((await context.cookies()).some((c) => c.name === "__Host-bp_a")).toBe(true);
  // Sahte çerezle korumalı sayfada veri değil, giriş ekranı görünür
  await page.goto("/admin/isletmeler");
  await expect(page.getByRole("heading", { name: "Platform Yönetimi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "İşletmeler" })).toHaveCount(0);
});

test("yanlış şifre hata mesajı gösterir ve e-posta alanı korunur", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("E-posta").fill(E2E_ADMIN.email);
  await page.getByLabel("Şifre").fill("YanlisSifre123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Giriş bilgileri hatalı");
  await expect(page.getByLabel("E-posta")).toHaveValue(E2E_ADMIN.email);
});

test("admin işletme oluşturur, işletme ilk girişte şifresini değiştirir", async ({ page, browser }, testInfo) => {
  const name = `E2E Berber ${testInfo.project.name} ${suffix}`;
  const login = `e2e-${testInfo.project.name}-${suffix}`;

  // Admin girişi
  await page.goto("/admin");
  await page.getByLabel("E-posta").fill(E2E_ADMIN.email);
  await page.getByLabel("Şifre").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.getByRole("heading", { name: "Gösterge Paneli" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("01-dashboard.png"), fullPage: true });

  // Boş form gönderimi → alan hataları
  await page.goto("/admin/isletmeler/yeni");
  await page.getByRole("button", { name: "İşletmeyi oluştur" }).click();
  await expect(page.getByText("Lütfen formdaki hataları düzeltin.")).toBeVisible();
  await expect(page.getByText("İl seçin.").first()).toBeVisible();

  // Formu doldur
  await page.getByLabel("İşletme adı").fill(name);
  await page.getByLabel("Telefon").fill("0532 123 45 67");
  await page.getByRole("combobox", { name: "İl", exact: true }).selectOption({ label: "İstanbul" });
  await page.getByRole("combobox", { name: "İlçe" }).selectOption({ label: "Kadıköy" });
  await page.getByLabel("Açık adres").fill("Caferağa Mah. Moda Cad. No:10");
  await page.getByLabel("Enlem").fill("40.987");
  await page.getByLabel("Boylam").fill("29.027");
  await page.getByLabel("Yetkili adı soyadı").fill("Ahmet Usta");
  await page.getByLabel("Kullanıcı adı").fill(login);
  await page.screenshot({ path: testInfo.outputPath("02-yeni-isletme.png"), fullPage: true });
  await page.getByRole("button", { name: "İşletmeyi oluştur" }).click();

  await expect(page.getByText("İşletme oluşturuldu", { exact: true })).toBeVisible();
  const tempPassword = (await page.getByTestId("temp-password").textContent())!.trim();
  expect(tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);
  await page.screenshot({ path: testInfo.outputPath("03-giris-bilgileri.png"), fullPage: true });

  // Detay: aktifleştir, yayın engeli
  await page.getByRole("link", { name: "İşletme detayına git" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "Aktifleştir" }).click();
  await expect(page.getByText("İşletme aktifleştirildi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yayına al" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("04-isletme-detay.png"), fullPage: true });

  // Listede arama
  await page.goto(`/admin/isletmeler?q=${encodeURIComponent(suffix)}`);
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible();

  // İşletme girişi (ayrı tarayıcı bağlamı)
  const biz = await browser.newContext({ ...testInfo.project.use });
  const bp = await biz.newPage();
  await bp.goto("/isletme");
  await bp.getByLabel("Kullanıcı adı").fill(login.toUpperCase());
  await bp.getByLabel("Şifre").fill(tempPassword);
  await bp.getByRole("button", { name: "Giriş yap" }).click();
  await expect(bp).toHaveURL(/\/isletme\/sifre-degistir$/);
  // Zorunlu değişim yapılmadan panele girilemez
  await bp.goto("/isletme/panel");
  await expect(bp).toHaveURL(/\/isletme\/sifre-degistir$/);

  await bp.getByLabel("Mevcut (geçici) şifre").fill(tempPassword);
  await bp.locator("#newPassword").fill("Makas2026kesim");
  await bp.getByLabel("Yeni şifre (tekrar)").fill("Farkli2026kesim");
  await bp.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await expect(bp.getByText("Şifreler eşleşmiyor.")).toBeVisible();
  await bp.getByLabel("Yeni şifre (tekrar)").fill("Makas2026kesim");
  await bp.getByRole("button", { name: "Şifreyi kaydet" }).click();
  await expect(bp).toHaveURL(/\/isletme\/panel/);
  await expect(bp.getByText("Şifreniz değiştirildi.")).toBeVisible();
  await expect(bp.getByText("Profilinizin yayına hazırlığı")).toBeVisible();
  await bp.screenshot({ path: testInfo.outputPath("05-isletme-panel.png"), fullPage: true });

  // İşletme oturumu admin paneline erişemez
  await bp.goto("/admin/isletmeler");
  await expect(bp).toHaveURL(/\/admin$/);
  await expect(bp.getByRole("heading", { name: "Platform Yönetimi" })).toBeVisible();

  await biz.close();

  // Admin askıya alır → işletme artık giremez
  await page.goto(`/admin/isletmeler?q=${encodeURIComponent(suffix)}`);
  await page.getByText(name).filter({ visible: true }).first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Askıya al" }).click();
  await expect(page.getByText("İşletme askıya alındı")).toBeVisible();

  const biz2 = await browser.newContext({ ...testInfo.project.use });
  const bp2 = await biz2.newPage();
  await bp2.goto("/isletme");
  await bp2.getByLabel("Kullanıcı adı").fill(login);
  await bp2.getByLabel("Şifre").fill("Makas2026kesim");
  await bp2.getByRole("button", { name: "Giriş yap" }).click();
  await expect(bp2.getByRole("alert").filter({ hasText: /\S/ })).toContainText("askıya alınmış");
  await biz2.close();

  // Çıkış
  if (testInfo.project.name === "mobil") await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("button", { name: "Çıkış yap" }).click();
  await expect(page.getByRole("heading", { name: "Platform Yönetimi" })).toBeVisible();
});
