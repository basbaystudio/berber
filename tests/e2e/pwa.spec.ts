import { expect, test } from "@playwright/test";

test.describe("PWA", () => {
  test("manifest ve ikonlar geçerli", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({ name: "Berber Randevu", display: "standalone", start_url: "/", lang: "tr" });
    for (const icon of m.icons as { src: string; sizes: string }[]) {
      const r = await request.get(icon.src);
      expect(r.ok(), icon.src).toBe(true);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
    expect((await request.get("/apple-icon.png")).ok()).toBe(true);
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["cache-control"]).toContain("no-cache");
  });

  test("service worker kurulur; bağlantı yokken çevrimdışı sayfası gösterilir, kişisel sayfalar önbellekten sunulmaz", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    // İlk kontrol: SW sayfayı denetlesin
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.goto("/ara").catch(() => {});
    await expect(page.getByRole("heading", { name: "İnternet bağlantısı yok" })).toBeVisible();
    // Önbellekte yalnızca statik dosyalar ve çevrimdışı sayfası var
    const keys = await page.evaluate(async () => {
      const out: string[] = [];
      for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(new URL(r.url).pathname);
      return out;
    });
    expect(keys.every((k) => k === "/cevrimdisi" || k.startsWith("/_next/static/") || k.startsWith("/icons/"))).toBe(true);
    await context.setOffline(false);
  });
});
