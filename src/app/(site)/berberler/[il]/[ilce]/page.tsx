import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db/client";
import { getActiveBanners, rotateAds } from "@/server/modules/admin/banners";
import { getDistrictBySlug, getProvinceBySlug } from "@/server/modules/marketplace/locations-seo";
import { enrichCards, searchBusinesses } from "@/server/modules/marketplace/search";
import { LocationLanding } from "@/components/marketplace/location-landing";

type Params = { params: Promise<{ il: string; ilce: string }> };

async function load(params: Params["params"]) {
  const { il, ilce } = await params;
  const p = await getProvinceBySlug(il);
  if (!p) return null;
  const d = await getDistrictBySlug(p.id, ilce);
  return d ? { p, d } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const x = await load(params);
  if (!x) return { title: "Bulunamadı" };
  const { total } = await searchBusinesses(db, { sirala: "onerilen", sayfa: 1, bugun: false, il: x.p.id, ilce: x.d.id }, { limit: 1 });
  return {
    title: `${x.d.name} Berber — ${x.p.name} · Online Randevu ve Fiyatlar`,
    description: `${x.d.name} (${x.p.name}) berberleri: saç kesimi, sakal tıraşı fiyatları, müşteri yorumları ve boş saatler. Online berber randevusu al.`,
    alternates: { canonical: `/berberler/${x.p.slug}/${x.d.slug}` },
    robots: total > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function DistrictLandingPage({ params }: Params) {
  await connection();
  const x = await load(params);
  if (!x) notFound();
  const r = await searchBusinesses(db, { sirala: "onerilen", sayfa: 1, bugun: false, il: x.p.id, ilce: x.d.id }, { limit: 18 });
  const [cards, ads] = [await enrichCards(r.cards), rotateAds(await getActiveBanners(db, { placement: "LISTING", provinceId: x.p.id }))];
  return (
    <LocationLanding
      place={x.d.name}
      parent={{ name: x.p.name, href: `/berberler/${x.p.slug}` }}
      cards={cards}
      total={r.total}
      searchHref={`/ara?il=${x.p.id}&ilce=${x.d.id}`}
      ads={ads}
      crumbs={[
        { name: "Ana sayfa", url: "/" },
        { name: `${x.p.name} berberleri`, url: `/berberler/${x.p.slug}` },
        { name: `${x.d.name} berberleri`, url: `/berberler/${x.p.slug}/${x.d.slug}` },
      ]}
    />
  );
}
