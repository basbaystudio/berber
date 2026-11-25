import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { publicCondition } from "@/server/modules/marketplace/search";
import { locationPairsWithBusinesses } from "@/server/modules/marketplace/locations-seo";
import { siteUrl } from "@/lib/site";
import { isLaunchMode } from "@/server/modules/marketplace/launch";

/** Yayındaki işletme profilleri, berberi olan şehir/ilçe sayfaları ve ana sayfalar. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = siteUrl();
  const [list, pairs] = [await db.select({ slug: businesses.slug, updatedAt: businesses.updatedAt }).from(businesses).where(publicCondition), await locationPairsWithBusinesses()];
  // Lansman modunda şehir/ilçe listeleri kapalı: arama motorlarına da verilmez
  const launch = await isLaunchMode();
  const provincesSet = launch ? [] : [...new Set(pairs.map((p) => p.province))];
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/basvuru`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/fiyatlandirma`, changeFrequency: "monthly", priority: 0.6 },
    ...provincesSet.map((p) => ({ url: `${base}/berberler/${p}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...(launch ? [] : pairs).map((x) => ({ url: `${base}/berberler/${x.province}/${x.district}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...list.map((b) => ({ url: `${base}/berber/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
