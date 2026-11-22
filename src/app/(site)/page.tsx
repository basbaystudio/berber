import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Store, Tag } from "lucide-react";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { getApplicationOffer } from "@/server/modules/applications";
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
  title: { absolute: "Online Berber Randevusu — Yakınındaki Berberi Bul | Dijital Berber" },
  description: "Yakınındaki berberleri keşfet, hizmet ve fiyatları karşılaştır, anlık boş saatleri gör ve online berber randevusu al. Ödeme dükkanda.",
  alternates: { canonical: "/" },
};

/** Ana sayfa yapılandırılmış verisi: site (Google'da site içi arama kutusu) ve kuruluş (logo). */
function homeJsonLd() {
  const url = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url,
      inLanguage: "tr-TR",
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${url}/ara?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
    { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url, logo: `${url}/brand/logo.png` },
  ];
}

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
  const offer = await getApplicationOffer(db);
  const nearby = loc ? await getNearby(loc) : null;
  // Reklam alanları: ziyaretçinin iline hedeflenmiş olanlar + herkese açık olanlar
  const ads = rotateAds(await getActiveBanners(db, { placement: "LISTING", provinceId: nearby?.provinceId ?? null }));
  // Aynı reklam sayfada bir kez gösterilir
  const ad = (i: number) => (ads[i] ? <AdCard ad={ads[i]} /> : null);
  const empty = !show.featured.length && !show.availableToday.length && !show.popular.length;
  const nearHref = loc ? `/ara?lat=${loc.lat.toFixed(3)}&lng=${loc.lng.toFixed(3)}&sirala=yakin` : undefined;
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 pb-8 pt-6 sm:px-6">
      {homeJsonLd().map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      ))}
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
      <section aria-labelledby="isletme-basvuru" className="flex flex-col items-start gap-5 rounded-3xl bg-brand-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-500">Berber misiniz?</p>
          <h2 id="isletme-basvuru" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Dükkanınızı ekleyin, {offer.currentFreeMonths} ay ücretsiz kullanın.
          </h2>
          <p className="text-brand-100">
            {offer.early.remaining > 0 ? `İlk ${offer.early.limit} işletmeye özel · kalan kontenjan ${offer.early.remaining}. ` : ""}Türkiye'nin her yerinden başvurabilirsiniz. Komisyon yok.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link href="/fiyatlandirma" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/40 px-6 font-semibold text-white hover:bg-white/10">
            <Tag className="size-5" aria-hidden /> Fiyatlandırma
          </Link>
          <Link href="/basvuru" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent-600 px-6 font-semibold text-white hover:bg-[#9a4000]">
            <Store className="size-5" aria-hidden /> İşletmeni ekle
          </Link>
        </div>
      </section>
    </main>
  );
}
