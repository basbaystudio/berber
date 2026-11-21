import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { db } from "@/server/db/client";
import { getActiveBanners, rotateAds } from "@/server/modules/admin/banners";
import { getHomeShowcases, listServiceTypesPublic } from "@/server/modules/marketplace/search";
import { getNearby, getVisitorLocation, NEARBY_RADIUS_KM } from "@/server/modules/marketplace/location";
import { getLocations } from "@/server/modules/reference/locations";
import { BannerCarousel } from "@/components/marketplace/banner-carousel";
import { AdCard, CardGrid } from "@/components/marketplace/business-card";
import { LocationPrompt } from "@/components/marketplace/location-prompt";
import { SearchBar } from "@/components/marketplace/search-bar";

export const metadata: Metadata = {
  title: { absolute: "Dijital Berber — Yakınındaki berberi bul, online randevu al" },
  description: "Yakınındaki berberleri keşfet, hizmet ve fiyatları incele, anlık boş saatleri gör ve online randevu al.",
};

function Section({ title, href, note, children }: { title: string; href?: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h2>
          {note && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">{note}</div>}
        </div>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
            Tümü <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  await connection();
  const [banners, show, types, locations, loc] = [
    await getActiveBanners(db, { placement: "HERO" }),
    await getHomeShowcases(),
    await listServiceTypesPublic(),
    await getLocations(),
    await getVisitorLocation(),
  ];
  const nearby = loc ? await getNearby(loc) : null;
  // Reklam alanları: ziyaretçinin iline hedeflenmiş olanlar + herkese açık olanlar
  const ads = rotateAds(await getActiveBanners(db, { placement: "LISTING", provinceId: nearby?.provinceId ?? null }));
  // Aynı reklam sayfada bir kez gösterilir
  const ad = (i: number) => (ads[i] ? <AdCard ad={ads[i]} /> : null);
  const empty = !show.featured.length && !show.availableToday.length && !show.popular.length;
  const nearHref = loc ? `/ara?lat=${loc.lat.toFixed(3)}&lng=${loc.lng.toFixed(3)}&sirala=yakin` : undefined;
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 pb-8 pt-6 sm:px-6">
      <BannerCarousel banners={banners} />
      <section className="mx-auto max-w-3xl space-y-5 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">Yakınındaki berberi bul, boş saati gör, randevunu al.</h1>
        <SearchBar provinces={locations.map((p) => ({ id: p.id, name: p.name }))} />
        <div className="flex flex-wrap justify-center gap-2">
          {types.map((t) => (
            <Link key={t.slug} href={`/ara?hizmet=${t.slug}`} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 hover:border-stone-400 hover:text-stone-900">
              {t.name}
            </Link>
          ))}
        </div>
      </section>
      {!loc && !empty && <LocationPrompt mode="ASK" />}
      {loc && nearby && (
        <Section
          title="Yakınındaki berberler"
          href={nearby.cards.length ? nearHref : undefined}
          note={
            <>
              <span>
                {loc.source === "PRECISE" ? "Konumuna göre" : `Yaklaşık konumuna göre${loc.city ? ` (${loc.city})` : ""}`}
                {nearby.cards.length === 0 && ` · ${NEARBY_RADIUS_KM} km içinde henüz berber yok`}
              </span>
              <LocationPrompt mode={loc.source === "PRECISE" ? "FORGET" : "REFINE"} />
            </>
          }
        >
          {nearby.cards.length > 0 && <CardGrid cards={nearby.cards} />}
        </Section>
      )}
      {ad(0)}
      {show.availableToday.length > 0 && (
        <Section title="Bugün müsait berberler" href="/ara?bugun=1">
          <CardGrid cards={show.availableToday.slice(0, 6)} />
        </Section>
      )}
      {show.featured.length > 0 && (
        <Section title="Öne çıkan berberler">
          <CardGrid cards={show.featured.slice(0, 6)} />
        </Section>
      )}
      {ad(1)}
      {show.popular.length > 0 && (
        <Section title="Popüler berberler" href="/ara?sirala=puan">
          <CardGrid cards={show.popular.slice(0, 6)} />
        </Section>
      )}
      {empty && <p className="text-center text-stone-500">Platformdaki berberler çok yakında burada listelenecek.</p>}
    </main>
  );
}
