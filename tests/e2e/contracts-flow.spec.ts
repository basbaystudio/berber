import { expect, test } from "@playwright/test";
import { adminLogin, businessFirstLogin, createBusinessViaAdmin } from "./helpers";

test("admin sözleşme yayınlar; işletme bildirim alır ve onaylar", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name === "mobil", "Akış masaüstünde doğrulanır");
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  await adminLogin(page);
  const login = `soz-${suffix}`;
  const { tempPassword } = await createBusinessViaAdmin(page, `Sözleşme Berber ${suffix}`, login);

  await page.goto("/admin/sozlesmeler");
  await page.getByLabel("Sözleşme adı").fill(`Hizmet Sözleşmesi ${suffix}`);
  await page.getByLabel("Kod").fill(`hizmet-${suffix}`);
  await page.getByRole("button", { name: "Oluştur" }).click();
  await expect(page.getByRole("heading", { name: `Hizmet Sözleşmesi ${suffix}` })).toBeVisible();
  await page.getByLabel("Sözleşme metni").fill("Madde 1 — Taraflar.\n\nBu sözleşme platform ile işletme arasındadır. ".repeat(3));
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Yayınla" }).click();
  await expect(page.getByText(/Sürüm 1 yayınlandı/)).toBeVisible();

  const { ctx, bp } = await businessFirstLogin(browser, testInfo, login, tempPassword);
  await expect(bp.getByText("Onayınızı bekleyen sözleşme var")).toBeVisible();
  await expect(bp.getByRole("link", { name: /Bildirimler, \d+ okunmamış/ })).toBeVisible();
  await bp.getByRole("link", { name: "Göz atıp onaylayın" }).click();
  await bp.getByRole("button", { name: "Onayla" }).click();
  await expect(bp.getByText("Onaylamak için sözleşmeyi okuduğunuzu işaretleyin.")).toBeVisible();
  await bp.getByLabel(/metnini okudum, kabul ediyorum/).check();
  await bp.getByRole("button", { name: "Onayla" }).click();
  await expect(bp.getByText(/Onaylandı ·/)).toBeVisible();
  await expect(bp.getByText("Onayınızı bekleyen sözleşme var")).toHaveCount(0);
  await bp.screenshot({ path: testInfo.outputPath("20-sozlesmeler.png"), fullPage: true });
  await bp.goto("/isletme/panel/bildirimler");
  await bp.getByRole("button", { name: "Tümünü okundu işaretle" }).click();
  await expect(bp.getByRole("link", { name: "Bildirimler", exact: true })).toBeVisible();
  await ctx.close();

  await page.reload();
  await expect(page.getByText(/Sürüm 1 onayları/)).toBeVisible();
});
