import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "@/server/db/client";
import { getSetting } from "@/server/modules/platform/settings";
import { enrichCards, searchBusinesses, type SearchFilters } from "./search";

/** Ziyaretçinin konum çerezi (yalnızca tarayıcıda saklanır, sunucuda kaydedilmez). */
export const LOCATION_COOKIE = "konum";
/** Yakındaki berberler için en fazla mesafe. */
export const NEARBY_RADIUS_KM = 50;

export type VisitorLocation = { lat: number; lng: number; source: "PRECISE" | "APPROX"; city: string | null };

/** Türkiye sınırları içinde mi (kaba kutu). */
export function inTurkey(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 35 && lat <= 43 && lng >= 25 && lng <= 46;
}

/** "41.012,28.976" → koordinat. Geçersizse null. */
export function parseLocationCookie(v: string | undefined | null) {
  const m = v?.match(/^(-?\d{1,3}\.\d{1,6}),(-?\d{1,3}\.\d{1,6})$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return inTurkey(lat, lng) ? { lat, lng } : null;
}

/**
 * Ziyaretçi konumu:
 * 1. Ziyaretçinin paylaştığı konum (çerez) — kesin.
 * 2. Vercel'in IP'ye göre eklediği yaklaşık konum başlıkları — izin gerektirmez, şehir düzeyinde.
 * İkisi de yoksa null.
 */
export async function getVisitorLocation(): Promise<VisitorLocation | null> {
  const precise = parseLocationCookie((await cookies()).get(LOCATION_COOKIE)?.value);
  if (precise) return { ...precise, source: "PRECISE", city: null };
  const h = await headers();
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lng = Number(h.get("x-vercel-ip-longitude"));
  if (!h.get("x-vercel-ip-latitude") || !inTurkey(lat, lng)) return null;
  let city: string | null = null;
  try {
    city = h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : null;
  } catch {
    city = null;
  }
  return { lat, lng, source: "APPROX", city };
}

/** Konuma en yakın berberler (yarıçap içinde, güven eşiği uygulanır) ve ziyaretçinin bulunduğu il (en yakın işletmeden). */
export async function getNearby(loc: VisitorLocation, limit = 6) {
  const threshold = await getSetting(db, "trust.showcaseThreshold");
  const f: SearchFilters = { sirala: "yakin", sayfa: 1, bugun: false, lat: loc.lat, lng: loc.lng };
  const { cards } = await searchBusinesses(db, f, { limit: limit * 2, minTrust: threshold });
  const near = cards.filter((c) => c.distanceKm != null && c.distanceKm <= NEARBY_RADIUS_KM).slice(0, limit);
  return { cards: await enrichCards(near), provinceId: near[0]?.provinceId ?? null, provinceName: near[0]?.province ?? null };
}
