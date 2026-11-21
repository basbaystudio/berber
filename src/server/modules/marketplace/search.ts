import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, type Executor } from "@/server/db/client";
import { businessTrustScores, businesses, districts, monthlyAwards, provinces, serviceTypes, services } from "@/server/db/schema";
import { getSetting } from "@/server/modules/platform/settings";
import { getAvailableSlots } from "@/server/modules/booking/availability";
import { loadOpenStateInput } from "@/server/modules/business/hours";
import { computeOpenState } from "@/lib/schedule";
import { todayTR } from "@/lib/dates";

export const searchSchema = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  il: z.coerce.number().int().positive().optional().catch(undefined),
  ilce: z.coerce.number().int().positive().optional().catch(undefined),
  hizmet: z.string().regex(/^[a-z0-9-]{1,60}$/).optional().catch(undefined),
  fiyatMin: z.coerce.number().int().min(0).max(1_000_000).optional().catch(undefined),
  fiyatMax: z.coerce.number().int().min(0).max(1_000_000).optional().catch(undefined),
  puan: z.coerce.number().min(1).max(5).optional().catch(undefined),
  bugun: z.preprocess((v) => v === "1" || v === "on", z.boolean()).catch(false),
  lat: z.coerce.number().min(35).max(43).optional().catch(undefined),
  lng: z.coerce.number().min(25).max(46).optional().catch(undefined),
  sirala: z.enum(["onerilen", "puan", "fiyat", "yakin"]).catch("onerilen"),
  sayfa: z.coerce.number().int().min(1).max(100).catch(1),
});
export type SearchFilters = z.infer<typeof searchSchema>;

export const PAGE_SIZE = 18;

/** Yayındaki ve aktif işletmeler (herkese açık tüm sorguların temel koşulu). */
export const publicCondition = and(eq(businesses.status, "ACTIVE"), eq(businesses.isPublished, true));

const haversineKm = (lat: number, lng: number) =>
  sql<number>`(6371 * 2 * asin(sqrt(power(sin(radians(${businesses.latitude} - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(${businesses.latitude})) * power(sin(radians(${businesses.longitude} - ${lng}) / 2), 2))))`;

/** Bayesçi yorum puanı: az yorumlu işletme ortalamaya çekilir (5 sanal yorum, 4.0 ortalama). */
const bayesRating = sql<number>`((${businesses.ratingAvg}::numeric * ${businesses.ratingCount} + 4.0 * 5) / (${businesses.ratingCount} + 5))`;

export type BusinessCard = {
  id: string;
  slug: string;
  name: string;
  district: string;
  province: string;
  provinceId: number;
  logoUrl: string | null;
  coverUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  minPriceKurus: number | null;
  distanceKm: number | null;
  trustScore: number | null;
  isFeatured: boolean;
  awardMonth: string | null;
};

export async function searchBusinesses(ex: Executor, f: SearchFilters, opts: { limit?: number; offset?: number; minTrust?: number; featuredOnly?: boolean } = {}) {
  const conds: SQL[] = [publicCondition!];
  if (f.q) conds.push(sql`${businesses.name} ILIKE ${"%" + f.q.replace(/[%_\\]/g, (m) => `\\${m}`) + "%"}`);
  if (f.il) conds.push(eq(businesses.provinceId, f.il));
  if (f.ilce) conds.push(eq(businesses.districtId, f.ilce));
  if (f.puan) conds.push(sql`${businesses.ratingAvg}::numeric >= ${f.puan} AND ${businesses.ratingCount} > 0`);
  if (opts.featuredOnly) conds.push(eq(businesses.isFeatured, true));
  if (opts.minTrust != null) conds.push(sql`coalesce(${businessTrustScores.score}::numeric, 70) >= ${opts.minTrust}`);
  // Hizmet türü ve/veya fiyat aralığı: koşula uyan aktif bir hizmeti olmalı
  if (f.hizmet || f.fiyatMin != null || f.fiyatMax != null) {
    const sc: SQL[] = [sql`${services.businessId} = ${businesses.id}`, sql`${services.isActive}`, sql`${services.deletedAt} IS NULL`];
    if (f.hizmet) sc.push(sql`${services.serviceTypeId} = (SELECT ${serviceTypes.id} FROM ${serviceTypes} WHERE ${serviceTypes.slug} = ${f.hizmet})`);
    if (f.fiyatMin != null) sc.push(sql`${services.priceKurus} >= ${f.fiyatMin * 100}`);
    if (f.fiyatMax != null) sc.push(sql`${services.priceKurus} <= ${f.fiyatMax * 100}`);
    conds.push(sql`EXISTS (SELECT 1 FROM ${services} WHERE ${and(...sc)})`);
  }
  const hasLoc = f.lat != null && f.lng != null;
  const dist = hasLoc ? haversineKm(f.lat!, f.lng!) : sql<number>`NULL`;
  if (hasLoc) conds.push(sql`${businesses.latitude} IS NOT NULL`);
  const trust = sql<number>`coalesce(${businessTrustScores.score}::numeric, 70)`;
  const recommended = sql`(${trust} / 100.0 * 0.5 + ${bayesRating} / 5.0 * 0.4 + CASE WHEN ${businesses.isFeatured} THEN 0.05 ELSE 0 END ${hasLoc ? sql`- least(${dist} / 50.0, 0.3)` : sql``})`;
  const order =
    f.sirala === "puan"
      ? [sql`${bayesRating} DESC`]
      : f.sirala === "fiyat"
        ? [sql`${businesses.minPriceKurus} ASC NULLS LAST`]
        : f.sirala === "yakin" && hasLoc
          ? [sql`${dist} ASC`]
          : [sql`${recommended} DESC`];
  const where = and(...conds);
  const rows = await ex
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      district: districts.name,
      province: provinces.name,
      provinceId: businesses.provinceId,
      logoUrl: businesses.logoUrl,
      coverUrl: businesses.coverUrl,
      ratingAvg: businesses.ratingAvg,
      ratingCount: businesses.ratingCount,
      minPriceKurus: businesses.minPriceKurus,
      distanceKm: dist,
      trustScore: businessTrustScores.score,
      isFeatured: businesses.isFeatured,
      awardMonth: sql<string | null>`(SELECT max(${monthlyAwards.month}) FROM ${monthlyAwards} WHERE ${monthlyAwards.businessId} = ${businesses.id})`,
    })
    .from(businesses)
    .innerJoin(provinces, eq(provinces.id, businesses.provinceId))
    .innerJoin(districts, eq(districts.id, businesses.districtId))
    .leftJoin(businessTrustScores, eq(businessTrustScores.businessId, businesses.id))
    .where(where)
    .orderBy(...order, asc(businesses.name))
    .limit(opts.limit ?? PAGE_SIZE)
    .offset(opts.offset ?? 0);
  const [{ n }] = (await ex
    .select({ n: sql<number>`count(*)::int` })
    .from(businesses)
    .leftJoin(businessTrustScores, eq(businessTrustScores.businessId, businesses.id))
    .where(where)) as [{ n: number }];
  const cards: BusinessCard[] = rows.map((r) => ({
    ...r,
    ratingAvg: Number(r.ratingAvg),
    distanceKm: r.distanceKm == null ? null : Number(r.distanceKm),
    trustScore: r.trustScore == null ? null : Number(r.trustScore),
  }));
  return { cards, total: n };
}

/**
 * Bugünkü ilk boş saat (en kısa aktif hizmete göre, tüm çalışanlar). Kartlarda "bugün ilk boş: 14:30" için.
 * 60 sn önbelleklenir; randevu olaylarında `availability:<id>` etiketiyle temizlenir.
 */
export function nextFreeToday(businessId: string): Promise<string | null> {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  return unstable_cache(
    async () => {
      const [svc] = await db
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.businessId, businessId), eq(services.isActive, true), isNull(services.deletedAt)))
        .orderBy(asc(services.durationMin))
        .limit(1);
      if (!svc) return null;
      try {
        const r = await getAvailableSlots(db, businessId, { date: todayTR(), selection: { serviceIds: [svc.id] }, mode: "ONLINE" });
        return r.slots[0]?.time ?? null;
      } catch {
        return null;
      }
    },
    ["next-free", businessId, String(minuteBucket)],
    { revalidate: 60, tags: [`availability:${businessId}`] },
  )();
}

export async function openStateOf(businessId: string) {
  return computeOpenState(await loadOpenStateInput(db, businessId), new Date());
}

/** Kartlar için canlı bilgiler: açık/kapalı + bugünkü ilk boş saat. */
export async function enrichCards(cards: BusinessCard[]) {
  return Promise.all(
    cards.map(async (c) => ({ ...c, open: await openStateOf(c.id), nextFree: await nextFreeToday(c.id) })),
  );
}
export type EnrichedCard = Awaited<ReturnType<typeof enrichCards>>[number];

/** Ana sayfa vitrinleri. Güven puanı eşiğin altındaki işletmeler vitrinlere giremez. */
export async function getHomeShowcases() {
  const threshold = await getSetting(db, "trust.showcaseThreshold");
  const base: SearchFilters = { sirala: "onerilen", sayfa: 1, bugun: false };
  const [featured, recommended, popular] = [
    (await searchBusinesses(db, base, { featuredOnly: true, minTrust: threshold, limit: 8 })).cards,
    (await searchBusinesses(db, base, { minTrust: threshold, limit: 24 })).cards,
    (await searchBusinesses(db, { ...base, sirala: "puan" }, { limit: 8 })).cards,
  ];
  const enriched = await enrichCards(recommended);
  const availableToday = enriched.filter((c) => c.nextFree).slice(0, 8);
  return { featured: await enrichCards(featured), availableToday, popular: await enrichCards(popular) };
}

export async function listServiceTypesPublic() {
  return db.select({ name: serviceTypes.name, slug: serviceTypes.slug }).from(serviceTypes).where(eq(serviceTypes.isActive, true)).orderBy(asc(serviceTypes.sortOrder));
}
