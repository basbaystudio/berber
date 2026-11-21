import "server-only";
import { eq } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { businesses, districts, provinces } from "@/server/db/schema";
import { notFound } from "@/server/lib/errors";

/**
 * İşletme profilini okur. İşletme profil bilgilerini (ad, adres, konum, telefon, e-posta, tanıtım, logo, kapak)
 * DEĞİŞTİREMEZ; tüm değişiklikler platform yönetimi (admin) tarafından yapılır.
 */
export async function getProfile(db: Executor, biz: { businessId: string }) {
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
