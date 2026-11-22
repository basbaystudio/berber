import type { Metadata } from "next";
import { connection } from "next/server";
import { db } from "@/server/db/client";
import { enrichCards, listServiceTypesPublic, PAGE_SIZE, searchBusinesses, searchSchema } from "@/server/modules/marketplace/search";
import { getSetting } from "@/server/modules/platform/settings";
import { getActiveBanners, rotateAds } from "@/server/modules/admin/banners";
import { getVisitorLocation } from "@/server/modules/marketplace/location";
import { getLocations } from "@/server/modules/reference/locations";
import { CardGrid } from "@/components/marketplace/business-card";
import { SearchFilters } from "@/components/marketplace/filters";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/feedback";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Object.values(sp).some(Boolean);
  return {
    title: "Berber bul",
    description: "İl, ilçe, hizmet, fiyat ve puana göre berber arayın; bugün müsait olanları görün ve online randevu alın.",
    alternates: { canonical: "/ara" },
    // Filtreli arama sonuçları çok sayıda kopya sayfa üretir; dizine yalnızca şehir/ilçe sayfaları eklenir
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  const raw = await searchParams;
  const parsed = searchSchema.parse(raw);
  // Konum verilmemiş ve il/ilçe seçilmemişse ziyaretçinin konumu öneri sırasına katılır (mesafe de kartta görünür)
  const loc = parsed.lat == null && !parsed.il && !parsed.ilce ? await getVisitorLocation() : null;
  const f = loc ? { ...parsed, lat: loc.lat, lng: loc.lng } : parsed;
  const [locations, types] = [await getLocations(), await listServiceTypesPublic()];
  let cards;
  let total;
  if (f.bugun) {
    // "Bugün müsait": öneri sırasındaki ilk 60 adaydan boş saati olanlar (güven eşiği uygulanır)
    const threshold = await getSetting(db, "trust.showcaseThreshold");
    const { cards: candidates } = await searchBusinesses(db, f, { limit: 60, minTrust: threshold });
    const all = (await enrichCards(candidates)).filter((c) => c.nextFree);
    total = all.length;
    cards = all.slice((f.sayfa - 1) * PAGE_SIZE, f.sayfa * PAGE_SIZE);
  } else {
    const r = await searchBusinesses(db, f, { offset: (f.sayfa - 1) * PAGE_SIZE });
    total = r.total;
    cards = await enrichCards(r.cards);
  }
  const ads = rotateAds(await getActiveBanners(db, { placement: "LISTING", provinceId: f.il ?? (loc ? cards[0]?.provinceId : null) ?? null }));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (v && k !== "sayfa") u.set(k, v);
    if (p > 1) u.set("sayfa", String(p));
    return `/ara?${u}`;
  };
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[16rem_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <details className="rounded-3xl border border-stone-200/80 bg-white p-5 lg:open:block" open>
          <summary className="cursor-pointer font-medium text-stone-900 lg:pointer-events-none lg:list-none">Filtreler</summary>
          <div className="mt-4">
            <SearchFilters locations={locations} types={types} values={raw} />
          </div>
        </details>
      </aside>
      <section className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          {total} berber bulundu{f.bugun ? " · bugün müsait" : ""}
        </h1>
        {cards.length === 0 ? (
          <div className="rounded-3xl border border-stone-200/80 bg-white">
            <EmptyState title="Sonuç bulunamadı" description="Filtreleri genişleterek tekrar deneyin." />
          </div>
        ) : (
          <CardGrid cards={cards} ads={ads} adEvery={6} />
        )}
        <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white empty:hidden">
          <Pagination page={f.sayfa} pageSize={PAGE_SIZE} total={total} hrefFor={qs} />
        </div>
      </section>
    </main>
  );
}
