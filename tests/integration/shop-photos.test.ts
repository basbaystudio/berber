import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { auditLogs, MAX_SHOP_PHOTOS } from "@/server/db/schema";
import { deleteShopPhoto, listShopPhotos, moveShopPhoto, setShopPhotoKind, uploadShopPhoto } from "@/server/modules/shop-photos";
import { makeAdmin, makeBusiness } from "../helpers/factory";

const img = (c = "#887766") => sharp({ create: { width: 800, height: 600, channels: 3, background: c } }).jpeg().toBuffer();
const code = (p: Promise<unknown>) => p.then(() => "OK", (e) => (e as { code?: string }).code);

describe("dükkan fotoğrafları", () => {
  it("yönetici ve işletme ekler; tür ve sıra değişir; işletme başkasının fotoğrafına dokunamaz", async () => {
    const admin = await makeAdmin();
    const a = await makeBusiness(admin.id);
    const b = await makeBusiness(admin.id);
    const asAdmin = { realm: "ADMIN" as const, adminId: admin.id };
    const asA = { realm: "BUSINESS" as const, userId: a.userId };
    const asB = { realm: "BUSINESS" as const, userId: b.userId };

    const p1 = (await uploadShopPhoto(db, asAdmin, a.businessId, "EXTERIOR", await img())).photo;
    const p2 = (await uploadShopPhoto(db, asA, a.businessId, "INTERIOR", await img("#334455"))).photo;
    let list = await listShopPhotos(db, a.businessId);
    expect(list.map((x) => [x.id, x.kind, x.uploadedBy])).toEqual([
      [p1.id, "EXTERIOR", "ADMIN"],
      [p2.id, "INTERIOR", "BUSINESS"],
    ]);
    expect(list[0]!.url).toMatch(/\.webp$/);

    await moveShopPhoto(db, a.businessId, p2.id, "up");
    await setShopPhotoKind(db, asA, a.businessId, p1.id, "INTERIOR");
    list = await listShopPhotos(db, a.businessId);
    expect(list.map((x) => x.id)).toEqual([p2.id, p1.id]);
    expect(list[1]!.kind).toBe("INTERIOR");

    // B işletmesi A'nın fotoğrafını silemez / değiştiremez (kendi businessId'si ile)
    expect(await code(deleteShopPhoto(db, asB, b.businessId, p1.id))).toBe("NOT_FOUND");
    expect(await code(setShopPhotoKind(db, asB, b.businessId, p1.id, "EXTERIOR"))).toBe("NOT_FOUND");
    expect(await code(moveShopPhoto(db, b.businessId, p1.id, "up"))).toBe("NOT_FOUND");

    await deleteShopPhoto(db, asA, a.businessId, p1.id);
    expect((await listShopPhotos(db, a.businessId)).map((x) => x.id)).toEqual([p2.id]);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.businessId, a.businessId));
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["shop_photo.upload", "shop_photo.kind", "shop_photo.delete"]));
  });

  it(`en fazla ${MAX_SHOP_PHOTOS} fotoğraf; eşzamanlı yüklemede de aşılamaz`, async () => {
    const admin = await makeAdmin();
    const a = await makeBusiness(admin.id);
    const asA = { realm: "BUSINESS" as const, userId: a.userId };
    const buf = await img();
    for (let i = 0; i < MAX_SHOP_PHOTOS - 2; i++) await uploadShopPhoto(db, asA, a.businessId, "INTERIOR", buf);
    const results = await Promise.all(Array.from({ length: 5 }, () => code(uploadShopPhoto(db, asA, a.businessId, "INTERIOR", buf))));
    expect(results.filter((r) => r === "OK")).toHaveLength(2);
    expect(results.filter((r) => r === "LIMIT_REACHED")).toHaveLength(3);
    expect(await listShopPhotos(db, a.businessId)).toHaveLength(MAX_SHOP_PHOTOS);
  });
});
