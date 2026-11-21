import "server-only";
import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { banners, provinces } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { deleteStoredImage, processAndStoreImage } from "@/server/storage/images";
import { checkbox, optionalText, trimmed, emptyToUndefined } from "@/lib/validation/common";
import { parseLocalDateTime } from "@/lib/dates";

type Actor = { adminId: string; ip?: string | null };

const linkSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/.test(v), "Bağlantı / ile başlamalı ya da https:// adresi olmalı.")
    .optional(),
);

const localDateTime = z.preprocess(emptyToUndefined, z.string().optional()).transform((v, ctx) => {
  if (!v) return null;
  const d = parseLocalDateTime(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Geçerli bir tarih seçin." });
    return z.NEVER;
  }
  return d;
});

export const bannerSchema = z
  .object({
    title: trimmed(2, 80, "Başlık"),
    subtitle: optionalText(160, "Alt başlık"),
    linkUrl: linkSchema,
    buttonText: optionalText(30, "Buton yazısı"),
    sortOrder: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(999)),
    placement: z.enum(["HERO", "LISTING"], { error: "Gösterim yeri seçin." }).catch("HERO"),
    provinceId: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(81).nullable()),
    isActive: checkbox,
    startsAt: localDateTime,
    endsAt: localDateTime,
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.startsAt < v.endsAt, { message: "Bitiş, başlangıçtan sonra olmalı.", path: ["endsAt"] })
  .refine((v) => !v.buttonText || v.linkUrl, { message: "Buton için bağlantı girin.", path: ["linkUrl"] })
  .refine((v) => v.placement !== "LISTING" || v.linkUrl, { message: "Reklam alanı için bağlantı girin.", path: ["linkUrl"] });

export type BannerInput = z.infer<typeof bannerSchema>;

export function listBanners(db: Executor) {
  return db
    .select({ b: banners, provinceName: provinces.name })
    .from(banners)
    .leftJoin(provinces, eq(provinces.id, banners.provinceId))
    .orderBy(asc(banners.placement), asc(banners.sortOrder), asc(banners.createdAt));
}

/**
 * Yayındaki bannerlar: aktif ve yayın aralığında.
 * HERO: ana sayfa üst alanı · LISTING: işletme listelerinin arasındaki reklam alanları.
 * İl hedefli bannerlar yalnızca o ildeki ziyaretçiye gösterilir; il bilinmiyorsa yalnızca hedefsizler.
 */
export function getActiveBanners(db: Executor, opts: { placement?: "HERO" | "LISTING"; provinceId?: number | null } = {}, now = new Date()) {
  const placement = opts.placement ?? "HERO";
  const target = opts.provinceId ? or(isNull(banners.provinceId), eq(banners.provinceId, opts.provinceId)) : isNull(banners.provinceId);
  return db
    .select({
      id: banners.id,
      title: banners.title,
      subtitle: banners.subtitle,
      imageUrl: banners.imageUrl,
      imageWidth: banners.imageWidth,
      imageHeight: banners.imageHeight,
      linkUrl: banners.linkUrl,
      buttonText: banners.buttonText,
    })
    .from(banners)
    .where(
      and(
        eq(banners.isActive, true),
        eq(banners.placement, placement),
        target,
        or(isNull(banners.startsAt), lte(banners.startsAt, now)),
        or(isNull(banners.endsAt), gt(banners.endsAt, now)),
      ),
    )
    .orderBy(asc(banners.sortOrder), asc(banners.createdAt))
    .limit(10);
}

export async function createBanner(db: DB, actor: Actor, input: BannerInput, image: Buffer) {
  const img = await processAndStoreImage(image, "banner", "banners");
  const [b] = await db
    .insert(banners)
    .values({
      title: input.title,
      subtitle: input.subtitle ?? null,
      linkUrl: input.linkUrl ?? null,
      buttonText: input.buttonText ?? null,
      sortOrder: input.sortOrder,
      placement: input.placement,
      provinceId: input.provinceId,
      isActive: input.isActive,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      imageKey: img.key,
      imageUrl: img.url,
      imageWidth: img.width,
      imageHeight: img.height,
    })
    .returning();
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "banner.create", entity: "banner", entityId: b!.id, ip: actor.ip });
  return b!;
}

export async function updateBanner(db: DB, actor: Actor, id: string, input: BannerInput, image: Buffer | null) {
  const [cur] = await db.select().from(banners).where(eq(banners.id, id));
  if (!cur) throw notFound("Banner");
  const img = image ? await processAndStoreImage(image, "banner", "banners") : null;
  await db
    .update(banners)
    .set({
      title: input.title,
      subtitle: input.subtitle ?? null,
      linkUrl: input.linkUrl ?? null,
      buttonText: input.buttonText ?? null,
      sortOrder: input.sortOrder,
      placement: input.placement,
      provinceId: input.provinceId,
      isActive: input.isActive,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      ...(img ? { imageKey: img.key, imageUrl: img.url, imageWidth: img.width, imageHeight: img.height } : {}),
      updatedAt: new Date(),
    })
    .where(eq(banners.id, id));
  if (img) await deleteStoredImage({ key: cur.imageKey, url: cur.imageUrl });
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "banner.update", entity: "banner", entityId: id, ip: actor.ip });
}

export async function deleteBanner(db: DB, actor: Actor, id: string) {
  const [cur] = await db.delete(banners).where(eq(banners.id, id)).returning();
  if (!cur) throw notFound("Banner");
  await deleteStoredImage({ key: cur.imageKey, url: cur.imageUrl });
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "banner.delete", entity: "banner", entityId: id, ip: actor.ip });
}

export function assertImageProvided(file: FormDataEntryValue | null) {
  if (!file || typeof file === "string" || file.size === 0) throw new AppError("VALIDATION", "Banner görseli seçin.", { file: "Banner görseli seçin." });
}

/** Reklam tıklaması: sayaç artırılır, kayıtlı bağlantı döner (yalnızca yayındaki banner). */
export async function recordBannerClick(db: Executor, id: string, count: boolean) {
  const now = new Date();
  const live = and(eq(banners.id, id), eq(banners.isActive, true), or(isNull(banners.startsAt), lte(banners.startsAt, now)), or(isNull(banners.endsAt), gt(banners.endsAt, now)));
  if (!count) {
    const [b] = await db.select({ linkUrl: banners.linkUrl }).from(banners).where(live);
    return b?.linkUrl ?? null;
  }
  const [b] = await db.update(banners).set({ clickCount: sql`${banners.clickCount} + 1` }).where(live).returning({ linkUrl: banners.linkUrl });
  return b?.linkUrl ?? null;
}

/**
 * Reklam sayısı alan sayısından fazlaysa hepsi gösterim alsın diye başlangıç saat başı kaydırılır
 * (sıra numarası düzeni korunur, yalnızca döngüsel olarak döner).
 */
export function rotateAds<T>(list: T[], now = Date.now()): T[] {
  if (list.length < 2) return list;
  const k = Math.floor(now / 3_600_000) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}
