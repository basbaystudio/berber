import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businesses, MAX_SHOP_PHOTOS, shopPhotos } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { deleteStoredImage, processAndStoreImage } from "@/server/storage/images";

/**
 * Dükkan fotoğrafları (iç mekân / dış cephe). Hem yönetici hem işletme yönetir; her işlem tek bir işletmeye
 * kapsanır (işletme için businessId oturumdan gelir, başka işletmenin fotoğrafına erişemez).
 */
export type ShopPhotoActor = { realm: "ADMIN"; adminId: string; ip?: string | null } | { realm: "BUSINESS"; userId: string };
export const shopPhotoKind = z.enum(["INTERIOR", "EXTERIOR"], { error: "Fotoğraf türü seçin." });
export type ShopPhotoKind = z.infer<typeof shopPhotoKind>;

const LIMIT_MSG = `Dükkan fotoğrafı limiti doldu (${MAX_SHOP_PHOTOS}/${MAX_SHOP_PHOTOS}). Yeni fotoğraf için önce birini silin.`;

function auditActor(a: ShopPhotoActor) {
  return a.realm === "ADMIN" ? { actorRealm: "ADMIN" as const, actorId: a.adminId, ip: a.ip ?? null } : { actorRealm: "BUSINESS" as const, actorId: a.userId };
}

export async function listShopPhotos(db: Executor, businessId: string) {
  return db
    .select({ id: shopPhotos.id, kind: shopPhotos.kind, url: shopPhotos.url, width: shopPhotos.width, height: shopPhotos.height, uploadedBy: shopPhotos.uploadedBy })
    .from(shopPhotos)
    .where(eq(shopPhotos.businessId, businessId))
    .orderBy(asc(shopPhotos.sortOrder), asc(shopPhotos.createdAt));
}

/** Yükleme: limit, işletme satırı kilitlenerek kesin uygulanır (eşzamanlı yüklemelerde de aşılamaz). */
export async function uploadShopPhoto(db: DB, actor: ShopPhotoActor, businessId: string, kind: ShopPhotoKind, image: Buffer) {
  const [pre] = await db.select({ n: sql<number>`count(*)::int` }).from(shopPhotos).where(eq(shopPhotos.businessId, businessId));
  if ((pre?.n ?? 0) >= MAX_SHOP_PHOTOS) throw new AppError("LIMIT_REACHED", LIMIT_MSG);
  const img = await processAndStoreImage(image, "portfolio", `businesses/${businessId}/shop`);
  try {
    return await db.transaction(async (tx) => {
      const [b] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).for("update");
      if (!b) throw notFound("İşletme");
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(shopPhotos).where(eq(shopPhotos.businessId, businessId))) as [{ n: number }];
      if (n >= MAX_SHOP_PHOTOS) throw new AppError("LIMIT_REACHED", LIMIT_MSG);
      const [last] = await tx.select({ s: shopPhotos.sortOrder }).from(shopPhotos).where(eq(shopPhotos.businessId, businessId)).orderBy(desc(shopPhotos.sortOrder)).limit(1);
      const [photo] = await tx
        .insert(shopPhotos)
        .values({
          businessId,
          kind,
          storageKey: img.key,
          url: img.url,
          width: img.width,
          height: img.height,
          sizeBytes: img.sizeBytes,
          sortOrder: (last?.s ?? -1) + 1,
          uploadedBy: actor.realm,
        })
        .returning();
      await audit(tx, { ...auditActor(actor), businessId, action: "shop_photo.upload", entity: "shop_photo", entityId: photo!.id, meta: { kind } });
      return { photo: photo!, used: n + 1 };
    });
  } catch (e) {
    await deleteStoredImage(img);
    throw e;
  }
}

export async function setShopPhotoKind(db: DB, actor: ShopPhotoActor, businessId: string, id: string, kind: ShopPhotoKind) {
  const r = await db.update(shopPhotos).set({ kind }).where(and(eq(shopPhotos.id, id), eq(shopPhotos.businessId, businessId))).returning({ id: shopPhotos.id });
  if (!r.length) throw notFound("Fotoğraf");
  await audit(db, { ...auditActor(actor), businessId, action: "shop_photo.kind", entity: "shop_photo", entityId: id, meta: { kind } });
}

export async function deleteShopPhoto(db: DB, actor: ShopPhotoActor, businessId: string, id: string) {
  const [p] = await db.delete(shopPhotos).where(and(eq(shopPhotos.id, id), eq(shopPhotos.businessId, businessId))).returning();
  if (!p) throw notFound("Fotoğraf");
  await deleteStoredImage({ key: p.storageKey, url: p.url });
  await audit(db, { ...auditActor(actor), businessId, action: "shop_photo.delete", entity: "shop_photo", entityId: id });
}

/** Sıralamada bir öne/arkaya taşır (komşuyla yer değiştirir). */
export async function moveShopPhoto(db: DB, businessId: string, id: string, dir: "up" | "down") {
  await db.transaction(async (tx) => {
    const list = await tx.select({ id: shopPhotos.id, s: shopPhotos.sortOrder }).from(shopPhotos).where(eq(shopPhotos.businessId, businessId)).orderBy(asc(shopPhotos.sortOrder), asc(shopPhotos.createdAt)).for("update");
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) throw notFound("Fotoğraf");
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    // Sıra numaralarını yeniden yaz (eşit sıra numaralarında da doğru çalışır)
    const order = list.map((p) => p.id);
    [order[i], order[j]] = [order[j]!, order[i]!];
    for (const [k, pid] of order.entries()) await tx.update(shopPhotos).set({ sortOrder: k }).where(eq(shopPhotos.id, pid));
  });
}
