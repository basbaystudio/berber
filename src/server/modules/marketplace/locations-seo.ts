import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { businesses, districts, provinces } from "@/server/db/schema";
import { publicCondition } from "./search";

/** Şehir/ilçe sayfaları için: slug → kayıt ve yayındaki berber sayıları. */
export async function getProvinceBySlug(slug: string) {
  const [p] = await db.select().from(provinces).where(eq(provinces.slug, slug)).limit(1);
  return p ?? null;
}

export async function getDistrictBySlug(provinceId: number, slug: string) {
  const [d] = await db.select().from(districts).where(and(eq(districts.provinceId, provinceId), eq(districts.slug, slug))).limit(1);
  return d ?? null;
}

/** İldeki ilçeler ve her birinde yayındaki berber sayısı (yalnızca berberi olanlar). */
export async function districtsWithBusinesses(provinceId: number) {
  return db
    .select({ name: districts.name, slug: districts.slug, n: count(businesses.id) })
    .from(districts)
    .innerJoin(businesses, and(eq(businesses.districtId, districts.id), publicCondition))
    .where(eq(districts.provinceId, provinceId))
    .groupBy(districts.id)
    .orderBy(sql`count(${businesses.id}) desc`, asc(districts.name));
}

/** Yayındaki berberi olan iller (site haritası, alt bilgi bağlantıları). */
export async function provincesWithBusinesses() {
  return db
    .select({ name: provinces.name, slug: provinces.slug, n: count(businesses.id) })
    .from(provinces)
    .innerJoin(businesses, and(eq(businesses.provinceId, provinces.id), publicCondition))
    .groupBy(provinces.id)
    .orderBy(sql`count(${businesses.id}) desc`, asc(provinces.name));
}

/** Site haritası için: berberi olan tüm il/ilçe çiftleri. */
export async function locationPairsWithBusinesses() {
  return db
    .selectDistinct({ province: provinces.slug, district: districts.slug })
    .from(businesses)
    .innerJoin(provinces, eq(provinces.id, businesses.provinceId))
    .innerJoin(districts, eq(districts.id, businesses.districtId))
    .where(publicCondition);
}
