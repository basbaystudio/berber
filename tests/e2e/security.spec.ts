import { expect, test } from "@playwright/test";
import { adminLogin } from "./helpers";

/** HTTP düzeyinde güvenlik kontrolleri: başlıklar, yetkisiz erişim, çapraz rol erişimi, CSP ihlali. */

const randomId = "3f2b6a3e-7c1d-4e0a-9b8f-2d4c6e8a0b1c";

test.describe("güvenlik", () => {
  test("güvenlik başlıkları her sayfada var", async ({ request }) => {
    for (const path of ["/", "/admin", "/isletme", "/giris"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      const h = res.headers();
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"]).toContain("object-src 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["strict-transport-security"]).toContain("max-age=");
      expect(h["x-powered-by"]).toBeUndefined();
    }
  });

  test("korumalı adresler oturumsuz erişilemez", async ({ request }) => {
    for (const [path, to] of [
      ["/admin/isletmeler", "/admin"],
      ["/isletme/panel", "/isletme"],
      ["/isletme/panel/abonelik", "/isletme"],
    ] as const) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBeGreaterThanOrEqual(300);
      expect(res.status()).toBeLessThan(400);
      expect(new URL(res.headers()["location"]!, "http://x").pathname).toBe(to);
    }
    // Müşteri hesabı sayfası giriş ekranına yönlenir
    const acc = await request.get("/hesabim", { maxRedirects: 0 });
    expect([303, 307, 308]).toContain(acc.status());
    expect(acc.headers()["location"]).toContain("/giris");
  });

  test("özel dosyalar ve zamanlanmış görev yetkisiz kapalı", async ({ request }) => {
    // Sahte oturum çereziyle dosya uçları 401 döner (proxy'yi geçse bile)
    const fake = { headers: { cookie: "__Host-bp_a=sahte; __Host-bp_b=sahte; bp_a=sahte; bp_b=sahte" }, maxRedirects: 0 };
    expect((await request.get(`/admin/dosya/fatura/${randomId}`, fake)).status()).toBe(401);
    expect((await request.get(`/admin/dosya/belge/${randomId}`, fake)).status()).toBe(401);
    expect((await request.get(`/isletme/panel/abonelik/fatura/${randomId}`, fake)).status()).toBe(401);
    expect((await request.get(`/isletme/panel/belgeler/dosya/${randomId}`, fake)).status()).toBe(401);

    expect((await request.get("/api/cron/daily")).status()).toBe(401);
    expect((await request.get("/api/cron/daily", { headers: { authorization: "Bearer yanlis" } })).status()).toBe(401);

    // Dizin dışına çıkma denemesi
    for (const p of ["/media/..%2F..%2Fpackage.json", "/media/%2e%2e/%2e%2e/.env", "/media/x/../../.env"]) {
      expect((await request.get(p)).status(), p).toBe(404);
    }
  });

  test("yönetici oturumu işletme dosyalarına, işletme uçlarına erişemez", async ({ page }) => {
    await adminLogin(page);
    const res = await page.request.get(`/isletme/panel/belgeler/dosya/${randomId}`, { maxRedirects: 0 });
    expect([303, 307, 401]).toContain(res.status());
    // Kendi alanında olmayan kayıt: 404 (varlık sızdırmaz)
    expect((await page.request.get(`/admin/dosya/fatura/${randomId}`)).status()).toBe(404);
    expect((await page.request.get(`/admin/dosya/fatura/gecersiz-id`)).status()).toBe(404);
  });

  test("oturum çerezi güvenli bayraklarla yazılır", async ({ page, context }) => {
    await adminLogin(page);
    const c = (await context.cookies()).find((x) => x.name.endsWith("bp_a"));
    expect(c).toBeDefined();
    expect(c!.httpOnly).toBe(true);
    expect(c!.sameSite).toBe("Lax");
    expect(c!.path).toBe("/");
  });

  test("başka siteden gelen server action isteği reddedilir", async ({ request }) => {
    const res = await request.post("/admin", {
      headers: { origin: "https://kotu-site.example", "next-action": "0".repeat(42), "content-type": "text/plain;charset=UTF-8" },
      data: "[]",
      maxRedirects: 0,
    });
    expect(res.status()).not.toBe(200);
  });

  test("ana sayfalarda CSP ihlali yok", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
    });
    for (const p of ["/", "/ara", "/giris", "/kayit", "/admin", "/isletme"]) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
    }
    expect(violations).toEqual([]);
  });
});
