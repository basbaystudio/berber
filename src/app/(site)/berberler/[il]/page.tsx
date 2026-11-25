import { redirect } from "next/navigation";
import { isLaunchMode } from "@/server/modules/marketplace/launch";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db/client";
import { getActiveBanners, rotateAds } from "@/server/modules/admin/banners";
import { districtsWithBusinesses, getProvinceBySlug } from "@/server/modules/marketplace/locations-seo";
import { enrichCards, searchBusinesses } from "@/server/modules/marketplace/search";
import { LocationLanding } from "@/components/marketplace/location-landing";

type Params = { params: Promise<{ il: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await getProvinceBySlug((await params).il);
  if (!p) return { title: "Bulunamadı" };
  const { total } = await searchBusinesses(db, { sirala: "onerilen", sayfa: 1, bugun: false, il: p.id }, { limit: 1 });
  return {
    title: `${p.name} Berber — Online Randevu, Fiyatlar ve Yorumlar`,
    description: `${p.name} berberleri: hizmetler, fiyatlar, müşteri yorumları ve boş saatler. Beklemeden online berber randevusu al.`,
    alternates: { canonical: `/berberler/${p.slug}` },
    // Henüz berber yoksa ince içerik: dizine eklenmesin
    robots: total > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function ProvinceLandingPage({ params }: Params) {
  if (await isLaunchMode()) redirect("/"); // lansman modunda pazaryeri listeleri kapalı
  await connection();
  const p = await getProvinceBySlug((await params).il);
  if (!p) notFound();
  const r = await searchBusinesses(db, { sirala: "onerilen", sayfa: 1, bugun: false, il: p.id }, { limit: 18 });
  const [cards, districtsList, ads] = [
    await enrichCards(r.cards),
    await districtsWithBusinesses(p.id),
    rotateAds(await getActiveBanners(db, { placement: "LISTING", provinceId: p.id })),
  ];
  return (
    <LocationLanding
      place={p.name}
      cards={cards}
      total={r.total}
      searchHref={`/ara?il=${p.id}`}
      subLinks={districtsList.map((d) => ({ name: d.name, href: `/berberler/${p.slug}/${d.slug}`, n: d.n }))}
      ads={ads}
      crumbs={[
        { name: "Ana sayfa", url: "/" },
        { name: `${p.name} berberleri`, url: `/berberler/${p.slug}` },
      ]}
    />
  );
}
