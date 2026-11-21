import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { publicCondition } from "@/server/modules/marketplace/search";

/** Yayındaki işletme profilleri + ana sayfalar. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const list = await db.select({ slug: businesses.slug, updatedAt: businesses.updatedAt }).from(businesses).where(publicCondition);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/ara`, changeFrequency: "daily", priority: 0.8 },
    ...list.map((b) => ({ url: `${base}/berber/${b.slug}`, lastModified: b.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
