import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { banners } from "@/server/db/schema";
import { bannerSchema, createBanner, getActiveBanners, recordBannerClick } from "@/server/modules/admin/banners";
import { makeAdmin, uid } from "../helpers/factory";

const img = () => sharp({ create: { width: 1200, height: 400, channels: 3, background: "#776655" } }).png().toBuffer();
const input = (over: Record<string, unknown>) => bannerSchema.parse({ title: `Reklam ${uid()}`, linkUrl: "/ara", isActive: "on", sortOrder: "0", ...over });

describe("banner ve reklam alanları", () => {
  it("gösterim yeri ve il hedefi ayrı ayrı uygulanır", async () => {
    const admin = await makeAdmin();
    const a = { adminId: admin.id };
    const hero = await createBanner(db, a, input({ placement: "HERO" }), await img());
    const all = await createBanner(db, a, input({ placement: "LISTING" }), await img());
    const ist = await createBanner(db, a, input({ placement: "LISTING", provinceId: "34" }), await img());
    const ank = await createBanner(db, a, input({ placement: "LISTING", provinceId: "6" }), await img());
    const past = await createBanner(db, a, input({ placement: "LISTING", startsAt: "2020-01-01T10:00", endsAt: "2020-02-01T10:00" }), await img());

    const ids = async (o: Parameters<typeof getActiveBanners>[1]) => (await getActiveBanners(db, o)).map((b) => b.id);
    expect(await ids({ placement: "HERO" })).toContain(hero.id);
    expect(await ids({ placement: "HERO" })).not.toContain(all.id);

    const noProvince = await ids({ placement: "LISTING" });
    expect(noProvince).toContain(all.id);
    expect(noProvince).not.toContain(ist.id); // il bilinmiyorsa hedefli reklam gösterilmez
    expect(noProvince).not.toContain(past.id);

    const istanbul = await ids({ placement: "LISTING", provinceId: 34 });
    expect(istanbul).toEqual(expect.arrayContaining([all.id, ist.id]));
    expect(istanbul).not.toContain(ank.id);
  });

  it("reklam alanı bağlantısız kaydedilemez; dış bağlantı yalnızca https", () => {
    expect(bannerSchema.safeParse({ title: "Reklam", placement: "LISTING", sortOrder: "0" }).success).toBe(false);
    expect(bannerSchema.safeParse({ title: "Reklam", placement: "LISTING", linkUrl: "http://site.example", sortOrder: "0" }).success).toBe(false);
    expect(bannerSchema.safeParse({ title: "Reklam", placement: "LISTING", linkUrl: "javascript:alert(1)", sortOrder: "0" }).success).toBe(false);
    expect(bannerSchema.safeParse({ title: "Reklam", placement: "LISTING", linkUrl: "//kotu.example", sortOrder: "0" }).success).toBe(false);
    expect(bannerSchema.safeParse({ title: "Reklam", placement: "LISTING", linkUrl: "https://site.example/kampanya", sortOrder: "0" }).success).toBe(true);
  });

  it("tıklama sayılır; pasif banner sayılmaz ve bağlantı dönmez", async () => {
    const admin = await makeAdmin();
    const b = await createBanner(db, { adminId: admin.id }, input({ placement: "LISTING", linkUrl: "https://site.example/x" }), await img());
    expect(await recordBannerClick(db, b.id, true)).toBe("https://site.example/x");
    expect(await recordBannerClick(db, b.id, false)).toBe("https://site.example/x"); // tekrar tıklama: yönlendirir ama saymaz
    expect((await db.select().from(banners).where(eq(banners.id, b.id)))[0]!.clickCount).toBe(1);
    await db.update(banners).set({ isActive: false }).where(eq(banners.id, b.id));
    expect(await recordBannerClick(db, b.id, true)).toBeNull();
    expect((await db.select().from(banners).where(eq(banners.id, b.id)))[0]!.clickCount).toBe(1);
  });
});

describe("reklam rotasyonu", () => {
  it("saat başı döner, sıra korunur", async () => {
    const { rotateAds } = await import("@/server/modules/admin/banners");
    expect(rotateAds([1, 2, 3], 0)).toEqual([1, 2, 3]);
    expect(rotateAds([1, 2, 3], 3_600_000)).toEqual([2, 3, 1]);
    expect(rotateAds([1, 2, 3], 2 * 3_600_000)).toEqual([3, 1, 2]);
    expect(rotateAds([1], 5 * 3_600_000)).toEqual([1]);
  });
});
