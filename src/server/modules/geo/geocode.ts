import "server-only";
import { z } from "zod";
import { logger } from "@/server/lib/logger";

/**
 * Adresten koordinat bulma (OpenStreetMap Nominatim, ücretsiz).
 * Kullanım kuralı: saniyede en fazla 1 istek, tanımlayıcı User-Agent. Yalnızca yönetici formunda, adres girilince
 * çağrılır (seyrek kullanım). İstek sunucudan yapılır; tarayıcıdan dış servise bağlantı açılmaz (CSP).
 */
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "DijitalBerber/1.0 (+https://www.dijitalberber.com)";

export const geocodeSchema = z.object({
  address: z.string().trim().min(3).max(300),
  district: z.string().trim().max(80).optional(),
  province: z.string().trim().max(80).optional(),
});
export type GeocodeInput = z.infer<typeof geocodeSchema>;
export type GeocodeResult = { lat: number; lng: number; precision: "ADDRESS" | "DISTRICT"; label: string } | null;

type Fetcher = typeof fetch;
let fetcher: Fetcher = (...a) => fetch(...a);
/** Yalnızca testler için. */
export function setGeocodeFetcherForTests(f: Fetcher | null) {
  fetcher = f ?? ((...a) => fetch(...a));
}

const hitSchema = z.array(z.object({ lat: z.string(), lon: z.string(), display_name: z.string().optional() }));

async function search(q: string) {
  const url = `${ENDPOINT}?${new URLSearchParams({ q, format: "jsonv2", countrycodes: "tr", limit: "1", "accept-language": "tr" })}`;
  const res = await fetcher(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const hits = hitSchema.safeParse(await res.json());
  const h = hits.success ? hits.data[0] : undefined;
  if (!h) return null;
  const lat = Number(h.lat);
  const lng = Number(h.lon);
  // Türkiye sınırları dışı sonuçları kabul etme
  if (!(lat >= 35 && lat <= 43 && lng >= 25 && lng <= 46)) return null;
  return { lat, lng, label: h.display_name ?? q };
}

/** Önce tam adresle, bulunamazsa sokak/kapı no kısmı atılmış haliyle, en son ilçe merkeziyle dener. */
export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult> {
  const area = [input.district, input.province].filter(Boolean).join(", ");
  const short = input.address
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(no|kat|daire|d)\b|^\d+[a-z]?$/i.test(p))
    .slice(0, 2)
    .join(", ");
  const attempts: [string, "ADDRESS" | "DISTRICT"][] = [
    [[input.address, area].filter(Boolean).join(", "), "ADDRESS"],
    ...(short && short !== input.address ? ([[[short, area].filter(Boolean).join(", "), "ADDRESS"]] as [string, "ADDRESS"][]) : []),
    ...(area ? ([[area, "DISTRICT"]] as [string, "DISTRICT"][]) : []),
  ];
  try {
    for (const [q, precision] of attempts) {
      const r = await search(q);
      if (r) return { ...r, precision };
    }
  } catch (e) {
    logger.warn("geocode başarısız", { error: e instanceof Error ? e.message : String(e) });
  }
  return null;
}
