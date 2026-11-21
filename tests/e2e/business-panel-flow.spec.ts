import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { adminLogin, businessFirstLogin, createBusinessViaAdmin } from "./helpers";

test.describe.configure({ mode: "serial" });

const shot = (testInfo: import("@playwright/test").TestInfo, name: string) => ({ path: testInfo.outputPath(name), fullPage: true });

test("işletme profilini hazırlar, admin yayına alır; banner ana sayfada görünür", async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const name = `Panel Berber ${suffix}`;
  const login = `panel-${suffix}`;
  // Not: dosya yolu ASCII olmalı (Türkçe karakterli yollarda tarayıcıya dosya aktarılamıyor)
  fs.mkdirSync("test-results", { recursive: true });
  const img = path.resolve("test-results", `ornek-${testInfo.project.name}.png`);
  const pdf = path.resolve("test-results", `belge-${testInfo.project.name}.pdf`);
  fs.writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 140, g: 110, b: 80 } } }).png().toFile(img);

  await adminLogin(page);
  const { tempPassword, detailUrl } = await createBusinessViaAdmin(page, name, login);
  const { ctx, bp } = await businessFirstLogin(browser, testInfo, login, tempPassword);

  // Çalışma saatleri
  await bp.goto("/isletme/panel/calisma-saatleri");
  await bp.locator("label", { has: bp.getByLabel("Pazartesi açık") }).click();
  await bp.getByRole("button", { name: "Pazartesiyi hafta içine kopyala" }).click();
  await bp.locator("label", { has: bp.getByLabel("Cumartesi açık") }).click();
  await bp.getByRole("button", { name: "Çalışma saatlerini kaydet" }).click();
  await expect(bp.getByText("Çalışma saatleri kaydedildi.")).toBeVisible();
  await bp.screenshot(shot(testInfo, "10-calisma-saatleri.png"));

  // Hizmetler
  await bp.goto("/isletme/panel/hizmetler");
  for (const [n, price, dur] of [["Saç Kesimi", "450", "30"], ["Sakal Tıraşı", "250", "20"]] as const) {
    await bp.getByLabel("Hizmet adı").fill(n);
    await bp.getByLabel("Fiyat (TL)").fill(price);
    await bp.getByLabel("Süre (dakika)").fill(dur);
    await bp.getByRole("button", { name: "Hizmet ekle" }).click();
    await expect(bp.getByText("Hizmet eklendi.")).toBeVisible();
    await expect(bp.getByRole("link", { name: new RegExp(n) })).toBeVisible();
  }
  // Doğrulama: geçersiz fiyat
  await bp.getByLabel("Hizmet adı").fill("Hatalı");
  await bp.getByLabel("Fiyat (TL)").fill("abc");
  await bp.getByRole("button", { name: "Hizmet ekle" }).click();
  await expect(bp.getByText(/Geçerli bir fiyat girin/)).toBeVisible();

  // Çalışan
  await bp.goto("/isletme/panel/calisanlar");
  await bp.getByLabel("Ad soyad").fill("Mehmet Usta");
  await bp.getByRole("button", { name: "Çalışan ekle" }).click();
  await expect(bp.getByText("Çalışan eklendi")).toBeVisible();
  await bp.getByRole("checkbox", { name: /Saç Kesimi/ }).check();
  await bp.getByRole("checkbox", { name: /Sakal Tıraşı/ }).check();
  await bp.getByRole("button", { name: "Hizmetleri kaydet" }).click();
  await expect(bp.getByText("Hizmetler kaydedildi.")).toBeVisible();
  await bp.getByRole("button", { name: "İşletme saatlerini kopyala" }).click();
  await bp.getByRole("button", { name: "Vardiyayı kaydet" }).click();
  await expect(bp.getByText("Vardiya kaydedildi.")).toBeVisible();
  await bp.screenshot(shot(testInfo, "11-calisan.png"));

  // Paket
  await bp.goto("/isletme/panel/paketler");
  await bp.getByRole("checkbox", { name: /Saç Kesimi/ }).check();
  await bp.getByRole("checkbox", { name: /Sakal Tıraşı/ }).check();
  await expect(bp.getByText("Hizmetlerin toplamı: 50 dk")).toBeVisible();
  await bp.getByLabel("Paket adı").fill("Kesim + Sakal");
  await bp.getByLabel("Paket fiyatı (TL)").fill("600");
  await bp.getByRole("checkbox", { name: /Mehmet Usta/ }).check();
  await bp.getByRole("button", { name: "Paket ekle" }).click();
  await expect(bp.getByText("Paket eklendi.")).toBeVisible();
  await expect(bp.getByRole("link", { name: /Kesim \+ Sakal/ })).toContainText("50 dk");

  // Portfolyo
  await bp.goto("/isletme/panel/portfolyo");
  await bp.waitForLoadState("networkidle"); // dosya seçimi React hazır olduktan sonra
  await bp.getByLabel("Portfolyo fotoğrafı seç").setInputFiles(img);
  await expect(bp.getByText("1 fotoğraf yüklendi.")).toBeVisible({ timeout: 20_000 });
  await expect(bp.getByText("1/30 fotoğraf kullanılıyor")).toBeVisible();
  await bp.screenshot(shot(testInfo, "12-portfolyo.png"));

  // Belgelerim: zorunlu belgeleri yükle
  await bp.goto("/isletme/panel/belgeler");
  await bp.waitForLoadState("networkidle");
  for (const docName of ["Vergi levhası", "İşyeri açma ve çalışma ruhsatı"]) {
    await bp.getByLabel(`${docName} dosyası`).setInputFiles(pdf);
    await bp.getByLabel(`${docName} dosyası`).locator("xpath=ancestor::form").getByRole("button", { name: "Yükle" }).click();
    await expect(bp.getByText("Belge yüklendi, incelemeye gönderildi.")).toBeVisible();
  }
  await bp.screenshot(shot(testInfo, "17-belgelerim.png"));

  // Bekleyen sözleşme varsa onayla (yayın için gerekli)
  await bp.goto("/isletme/panel/sozlesmeler");
  while ((await bp.getByLabel(/metnini okudum, kabul ediyorum/).count()) > 0) {
    const before = await bp.getByLabel(/metnini okudum, kabul ediyorum/).count();
    await bp.getByLabel(/metnini okudum, kabul ediyorum/).first().check();
    await bp.getByRole("button", { name: "Onayla" }).first().click();
    await expect(bp.getByLabel(/metnini okudum, kabul ediyorum/)).toHaveCount(before - 1);
  }

  // Profil salt okunur: işletme bilgileri değiştiremez
  await bp.goto("/isletme/panel/profil");
  await expect(bp.getByText("Bilgileri değiştirmek mi istiyorsunuz?")).toBeVisible();
  await expect(bp.locator("main input, main textarea")).toHaveCount(0);

  // Genel bakış
  await bp.goto("/isletme/panel");
  await expect(bp.getByText("Ücretsiz dönem — şu an ödeme alınmıyor")).toBeVisible();
  await bp.screenshot(shot(testInfo, "13-isletme-genel-bakis.png"));
  await ctx.close();

  // Admin: belgeleri onayla
  await page.goto(detailUrl);
  const approveButtons = page.getByRole("button", { name: "Onayla", exact: true });
  await expect(approveButtons).toHaveCount(2);
  await approveButtons.first().click();
  await expect(approveButtons).toHaveCount(1);
  await approveButtons.first().click();
  await expect(approveButtons).toHaveCount(0);
  await expect(page.getByText(/^Onaylandı ·/)).toHaveCount(2);

  // Admin: aktifleştir ve yayına al
  await page.getByRole("button", { name: "Aktifleştir" }).click();
  await expect(page.getByText("İşletme aktifleştirildi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yayına al" })).toBeEnabled();
  await page.getByRole("button", { name: "Yayına al" }).click();
  await expect(page.getByText("İşletme yayına alındı.")).toBeVisible();
  await page.screenshot(shot(testInfo, "14-admin-yayinda.png"));

  // Abonelikler sayfası
  await page.goto("/admin/abonelikler");
  await expect(page.getByText(/Kullanılan: \d+\/20/)).toBeVisible();
  await page.screenshot(shot(testInfo, "15-abonelikler.png"));

  // Banner → ana sayfa (yalnızca masaüstü projesinde ekle; mobilde aynı banner görüntülenir)
  const bannerTitle = `Açılışa özel fırsat ${suffix}`;
  await page.goto("/admin/bannerlar");
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').first().setInputFiles(img);
  await page.getByLabel("Başlık").first().fill(bannerTitle);
  await page.getByLabel("Alt başlık").first().fill("Yakınındaki berberleri keşfet");
  await page.getByLabel("Buton yazısı").first().fill("Keşfet");
  await page.getByLabel("Bağlantı").first().fill("/");
  await page.getByRole("button", { name: "Banner ekle" }).click();
  await expect(page.getByText("Banner eklendi.")).toBeVisible({ timeout: 20_000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: bannerTitle })).toBeVisible();
  await page.screenshot(shot(testInfo, "16-ana-sayfa.png"));
});
