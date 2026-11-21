import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businesses, districts, provinces } from "@/server/db/schema";
import { notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { deleteStoredImage, processAndStoreImage } from "@/server/storage/images";
import { optionalText, trPhone } from "@/lib/validation/common";
import { bizAudit, type Biz } from "./context";

/** İşletmenin kendi düzenleyebildiği alanlar. Ad, bağlantı adı ve adres platform yönetimindedir. */
export const profileSchema = z.object({ phone: trPhone, description: optionalText(1000, "Açıklama") });

export async function getProfile(db: Executor, biz: Pick<Biz, "businessId">) {
  const [row] = await db
    .select({ b: businesses, province: provinces.name, district: districts.name })
    .from(businesses)
    .innerJoin(provinces, eq(provinces.id, businesses.provinceId))
    .innerJoin(districts, eq(districts.id, businesses.districtId))
    .where(eq(businesses.id, biz.businessId))
    .limit(1);
  if (!row) throw notFound("İşletme");
  return { ...row.b, provinceName: row.province, districtName: row.district };
}

export async function updateProfile(db: DB, biz: Biz, input: z.infer<typeof profileSchema>) {
  await db
    .update(businesses)
    .set({ phone: input.phone, description: input.description ?? null, updatedAt: new Date() })
    .where(eq(businesses.id, biz.businessId));
  await audit(db, { ...bizAudit(biz), action: "business.profile_update" });
}

export async function setBusinessImage(db: DB, biz: Biz, kind: "logo" | "cover", image: Buffer) {
  const [cur] = await db.select().from(businesses).where(eq(businesses.id, biz.businessId));
  if (!cur) throw notFound("İşletme");
  const img = await processAndStoreImage(image, kind, `businesses/${biz.businessId}/${kind}`);
  await db
    .update(businesses)
    .set(kind === "logo" ? { logoKey: img.key, logoUrl: img.url, updatedAt: new Date() } : { coverKey: img.key, coverUrl: img.url, updatedAt: new Date() })
    .where(eq(businesses.id, biz.businessId));
  const old = kind === "logo" ? { key: cur.logoKey, url: cur.logoUrl } : { key: cur.coverKey, url: cur.coverUrl };
  if (old.key && old.url) await deleteStoredImage({ key: old.key, url: old.url });
  await audit(db, { ...bizAudit(biz), action: `business.${kind}_update` });
}

export async function removeBusinessImage(db: DB, biz: Biz, kind: "logo" | "cover") {
  const [cur] = await db.select().from(businesses).where(eq(businesses.id, biz.businessId));
  if (!cur) throw notFound("İşletme");
  await db
    .update(businesses)
    .set(kind === "logo" ? { logoKey: null, logoUrl: null } : { coverKey: null, coverUrl: null })
    .where(eq(businesses.id, biz.businessId));
  const old = kind === "logo" ? { key: cur.logoKey, url: cur.logoUrl } : { key: cur.coverKey, url: cur.coverUrl };
  if (old.key && old.url) await deleteStoredImage({ key: old.key, url: old.url });
}
