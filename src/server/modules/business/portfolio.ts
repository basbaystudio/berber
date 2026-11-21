import "server-only";
import { and, asc, eq, gt, lt, sql, desc } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businesses, MAX_PORTFOLIO_PHOTOS, portfolioCategories, portfolioPhotos, staff } from "@/server/db/schema";
import { AppError, notFound, pgErrorCode, PG } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { deleteStoredImage, processAndStoreImage, type ProcessedImage } from "@/server/storage/images";
import { emptyToUndefined, optionalText, trimmed } from "@/lib/validation/common";
import { bizAudit, type Biz } from "./context";

export const photoMetaSchema = z.object({
  caption: optionalText(200, "Açıklama"),
  categoryId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  staffId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});
export type PhotoMeta = z.infer<typeof photoMetaSchema>;

export const categorySchema = z.object({ name: trimmed(2, 40, "Kategori adı") });

const LIMIT_MSG = `Fotoğraf limitiniz doldu (${MAX_PORTFOLIO_PHOTOS}/${MAX_PORTFOLIO_PHOTOS}). Yeni fotoğraf eklemek için önce bir fotoğrafı silin.`;

export async function getPortfolio(db: Executor, businessId: string) {
  const [photos, categories, [b]] = [
    await db.select().from(portfolioPhotos).where(eq(portfolioPhotos.businessId, businessId)).orderBy(asc(portfolioPhotos.sortOrder), asc(portfolioPhotos.createdAt)),
    await db.select().from(portfolioCategories).where(eq(portfolioCategories.businessId, businessId)).orderBy(asc(portfolioCategories.sortOrder), asc(portfolioCategories.name)),
    await db.select({ photoCount: businesses.photoCount }).from(businesses).where(eq(businesses.id, businessId)),
  ];
  return { photos, categories, used: b?.photoCount ?? 0, limit: MAX_PORTFOLIO_PHOTOS };
}

/** Kategori/çalışan bu işletmeye mi ait? (bileşik FK de ayrıca korur) */
async function assertMetaOwned(db: Executor, businessId: string, meta: PhotoMeta) {
  if (meta.categoryId) {
    const [c] = await db.select({ id: portfolioCategories.id }).from(portfolioCategories).where(and(eq(portfolioCategories.id, meta.categoryId), eq(portfolioCategories.businessId, businessId)));
    if (!c) throw new AppError("VALIDATION", "Kategori bulunamadı.", { categoryId: "Kategori bulunamadı." });
  }
  if (meta.staffId) {
    const [s] = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, meta.staffId), eq(staff.businessId, businessId)));
    if (!s) throw new AppError("VALIDATION", "Çalışan bulunamadı.", { staffId: "Çalışan bulunamadı." });
  }
}

/**
 * Fotoğraf yükleme. 30 limiti veritabanında atomik sayaçla uygulanır:
 * eşzamanlı yüklemelerde bile limit aşılamaz. Görsel önce işlenir; limit doluysa depolanan dosya silinir.
 */
export async function uploadPhoto(db: DB, biz: Biz, image: Buffer, meta: PhotoMeta) {
  await assertMetaOwned(db, biz.businessId, meta);
  // Hızlı ön kontrol (kesin kontrol transaction'da)
  const [pre] = await db.select({ n: businesses.photoCount }).from(businesses).where(eq(businesses.id, biz.businessId));
  if ((pre?.n ?? 0) >= MAX_PORTFOLIO_PHOTOS) throw new AppError("LIMIT_REACHED", LIMIT_MSG);

  const img: ProcessedImage = await processAndStoreImage(image, "portfolio", `businesses/${biz.businessId}/portfolio`);
  try {
    return await db.transaction(async (tx) => {
      const reserved = await tx
        .update(businesses)
        .set({ photoCount: sql`${businesses.photoCount} + 1` })
        .where(and(eq(businesses.id, biz.businessId), lt(businesses.photoCount, MAX_PORTFOLIO_PHOTOS)))
        .returning({ n: businesses.photoCount });
      if (!reserved.length) throw new AppError("LIMIT_REACHED", LIMIT_MSG);
      const [last] = await tx
        .select({ s: portfolioPhotos.sortOrder })
        .from(portfolioPhotos)
        .where(eq(portfolioPhotos.businessId, biz.businessId))
        .orderBy(desc(portfolioPhotos.sortOrder))
        .limit(1);
      const [photo] = await tx
        .insert(portfolioPhotos)
        .values({
          businessId: biz.businessId,
          staffId: meta.staffId ?? null,
          categoryId: meta.categoryId ?? null,
          caption: meta.caption ?? null,
          storageKey: img.key,
          url: img.url,
          width: img.width,
          height: img.height,
          sizeBytes: img.sizeBytes,
          mime: img.mime,
          sortOrder: (last?.s ?? -1) + 1,
        })
        .returning();
      await audit(tx, { ...bizAudit(biz), action: "portfolio.upload", entity: "photo", entityId: photo!.id, meta: { count: reserved[0]!.n } });
      return { photo: photo!, used: reserved[0]!.n };
    });
  } catch (e) {
    await deleteStoredImage(img);
    if (pgErrorCode(e) === PG.CHECK_VIOLATION) throw new AppError("LIMIT_REACHED", LIMIT_MSG);
    throw e;
  }
}

async function ownPhoto(db: Executor, businessId: string, id: string) {
  const [p] = await db.select().from(portfolioPhotos).where(and(eq(portfolioPhotos.id, id), eq(portfolioPhotos.businessId, businessId)));
  if (!p) throw notFound("Fotoğraf");
  return p;
}

export async function updatePhotoMeta(db: DB, biz: Biz, id: string, meta: PhotoMeta) {
  await ownPhoto(db, biz.businessId, id);
  await assertMetaOwned(db, biz.businessId, meta);
  await db
    .update(portfolioPhotos)
    .set({ caption: meta.caption ?? null, categoryId: meta.categoryId ?? null, staffId: meta.staffId ?? null })
    .where(and(eq(portfolioPhotos.id, id), eq(portfolioPhotos.businessId, biz.businessId)));
}

/** Görseli değiştirir (limit etkilenmez). */
export async function replacePhoto(db: DB, biz: Biz, id: string, image: Buffer) {
  const cur = await ownPhoto(db, biz.businessId, id);
  const img = await processAndStoreImage(image, "portfolio", `businesses/${biz.businessId}/portfolio`);
  await db
    .update(portfolioPhotos)
    .set({ storageKey: img.key, url: img.url, width: img.width, height: img.height, sizeBytes: img.sizeBytes, mime: img.mime })
    .where(and(eq(portfolioPhotos.id, id), eq(portfolioPhotos.businessId, biz.businessId)));
  await deleteStoredImage({ key: cur.storageKey, url: cur.url });
  await audit(db, { ...bizAudit(biz), action: "portfolio.replace", entity: "photo", entityId: id });
}

export async function deletePhoto(db: DB, biz: Biz, id: string) {
  const deleted = await db.transaction(async (tx) => {
    const [p] = await tx
      .delete(portfolioPhotos)
      .where(and(eq(portfolioPhotos.id, id), eq(portfolioPhotos.businessId, biz.businessId)))
      .returning();
    if (!p) throw notFound("Fotoğraf");
    await tx
      .update(businesses)
      .set({ photoCount: sql`greatest(${businesses.photoCount} - 1, 0)` })
      .where(eq(businesses.id, biz.businessId));
    await audit(tx, { ...bizAudit(biz), action: "portfolio.delete", entity: "photo", entityId: id });
    return p;
  });
  await deleteStoredImage({ key: deleted.storageKey, url: deleted.url });
}

/** Sıralamada bir öne/arkaya taşır (komşuyla yer değiştirir). */
export async function movePhoto(db: DB, biz: Biz, id: string, dir: "up" | "down") {
  await db.transaction(async (tx) => {
    const cur = await ownPhoto(tx, biz.businessId, id);
    const [nb] = await tx
      .select()
      .from(portfolioPhotos)
      .where(
        and(
          eq(portfolioPhotos.businessId, biz.businessId),
          dir === "up" ? lt(portfolioPhotos.sortOrder, cur.sortOrder) : gt(portfolioPhotos.sortOrder, cur.sortOrder),
        ),
      )
      .orderBy(dir === "up" ? desc(portfolioPhotos.sortOrder) : asc(portfolioPhotos.sortOrder))
      .limit(1);
    if (!nb) return;
    await tx.update(portfolioPhotos).set({ sortOrder: nb.sortOrder }).where(eq(portfolioPhotos.id, cur.id));
    await tx.update(portfolioPhotos).set({ sortOrder: cur.sortOrder }).where(eq(portfolioPhotos.id, nb.id));
  });
}

export async function createCategory(db: DB, biz: Biz, name: string) {
  try {
    await db.insert(portfolioCategories).values({ businessId: biz.businessId, name });
  } catch (e) {
    if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw new AppError("CONFLICT", "Bu isimde bir kategori zaten var.", { name: "Bu isim kullanılıyor." });
    throw e;
  }
}

/** Kategori silinince fotoğraflar kategorisiz kalır. */
export async function deleteCategory(db: DB, biz: Biz, id: string) {
  await db.transaction(async (tx) => {
    await tx.update(portfolioPhotos).set({ categoryId: null }).where(and(eq(portfolioPhotos.businessId, biz.businessId), eq(portfolioPhotos.categoryId, id)));
    const res = await tx
      .delete(portfolioCategories)
      .where(and(eq(portfolioCategories.id, id), eq(portfolioCategories.businessId, biz.businessId)))
      .returning({ id: portfolioCategories.id });
    if (!res.length) throw notFound("Kategori");
  });
}
