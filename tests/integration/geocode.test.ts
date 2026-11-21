import { afterEach, describe, expect, it } from "vitest";
import { geocodeAddress, setGeocodeFetcherForTests } from "@/server/modules/geo/geocode";

/** Sahte harita servisi: sorgu → sonuç. Gerçek ağa çıkılmaz. */
function fake(map: Record<string, { lat: string; lon: string }[]>) {
  const calls: string[] = [];
  setGeocodeFetcherForTests((async (url: string | URL | Request, init?: RequestInit) => {
    const q = new URL(String(url)).searchParams.get("q")!;
    calls.push(q);
    expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/DijitalBerber/);
    return new Response(JSON.stringify(map[q] ?? []), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch);
  return calls;
}

afterEach(() => setGeocodeFetcherForTests(null));

describe("adresten konum", () => {
  it("tam adres bulunursa adres hassasiyetinde döner", async () => {
    const calls = fake({ "Caferağa Mah. Moda Cad. No:42, Kadıköy, İstanbul": [{ lat: "40.9862", lon: "29.0261" }] });
    const r = await geocodeAddress({ address: "Caferağa Mah. Moda Cad. No:42", district: "Kadıköy", province: "İstanbul" });
    expect(r).toMatchObject({ lat: 40.9862, lng: 29.0261, precision: "ADDRESS" });
    expect(calls).toHaveLength(1);
  });

  it("kapı no ile bulunamazsa sadeleştirir, o da olmazsa ilçe merkezine düşer", async () => {
    const calls = fake({ "Kadıköy, İstanbul": [{ lat: "40.99", lon: "29.03" }] });
    const r = await geocodeAddress({ address: "Bilinmez Sok., No: 5", district: "Kadıköy", province: "İstanbul" });
    expect(r).toMatchObject({ precision: "DISTRICT", lat: 40.99 });
    expect(calls).toEqual(["Bilinmez Sok., No: 5, Kadıköy, İstanbul", "Bilinmez Sok., Kadıköy, İstanbul", "Kadıköy, İstanbul"]);
  });

  it("Türkiye dışı sonuç ve servis hatası boş döner", async () => {
    fake({ "X Cad., Kadıköy, İstanbul": [{ lat: "51.5", lon: "-0.12" }] });
    expect(await geocodeAddress({ address: "X Cad.", district: "Kadıköy", province: "İstanbul" })).toBeNull();
    setGeocodeFetcherForTests((async () => new Response("hata", { status: 503 })) as unknown as typeof fetch);
    expect(await geocodeAddress({ address: "X Cad.", district: "Kadıköy", province: "İstanbul" })).toBeNull();
  });
});
