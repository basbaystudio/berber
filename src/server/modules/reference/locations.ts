import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db/client";
import { districts, provinces } from "@/server/db/schema";

export type ProvinceWithDistricts = { id: number; name: string; districts: { id: number; name: string }[] };

const collator = new Intl.Collator("tr-TR");

/** İl/ilçe listesi nadiren değişir; önbelleklenir. */
export const getLocations = unstable_cache(
  async (): Promise<ProvinceWithDistricts[]> => {
    const [ps, ds] = await Promise.all([db.select().from(provinces), db.select().from(districts)]);
    const byProvince = new Map<number, { id: number; name: string }[]>();
    for (const d of ds) {
      const list = byProvince.get(d.provinceId) ?? [];
      list.push({ id: d.id, name: d.name });
      byProvince.set(d.provinceId, list);
    }
    return ps
      .map((p) => ({ id: p.id, name: p.name, districts: (byProvince.get(p.id) ?? []).sort((a, b) => collator.compare(a.name, b.name)) }))
      .sort((a, b) => collator.compare(a.name, b.name));
  },
  ["locations-v1"],
  { revalidate: 86400 },
);
