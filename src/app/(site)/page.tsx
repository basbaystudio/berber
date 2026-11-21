import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { db } from "@/server/db/client";
import { getActiveBanners } from "@/server/modules/admin/banners";
import { getHomeShowcases, listServiceTypesPublic } from "@/server/modules/marketplace/search";
import { getLocations } from "@/server/modules/reference/locations";
import { BannerCarousel } from "@/components/marketplace/banner-carousel";
import { CardGrid } from "@/components/marketplace/business-card";
import { SearchBar } from "@/components/marketplace/search-bar";

export const metadata: Metadata = {
  title: { absolute: "Berber Randevu — Yakınındaki berberi bul, online randevu al" },
  description: "Yakınındaki berberleri keşfet, hizmet ve fiyatları incele, anlık boş saatleri gör ve online randevu al.",
};

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h2>
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
  const [banners, show, types, locations] = [await getActiveBanners(db), await getHomeShowcases(), await listServiceTypesPublic(), await getLocations()];
  const empty = !show.featured.length && !show.availableToday.length && !show.popular.length;
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
      {show.popular.length > 0 && (
        <Section title="Popüler berberler" href="/ara?sirala=puan">
          <CardGrid cards={show.popular.slice(0, 6)} />
        </Section>
      )}
      {empty && <p className="text-center text-stone-500">Platformdaki berberler çok yakında burada listelenecek.</p>}
    </main>
  );
}
