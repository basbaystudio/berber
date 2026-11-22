import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CardGrid, type AdBanner } from "@/components/marketplace/business-card";
import type { EnrichedCard } from "@/server/modules/marketplace/search";
import { siteUrl } from "@/lib/site";

/** Şehir/ilçe açılış sayfası (yerel arama: "Kadıköy berber", "İstanbul berber randevu"). */
export function LocationLanding({
  place,
  parent,
  cards,
  total,
  searchHref,
  subLinks,
  ads,
  crumbs,
}: {
  place: string;
  parent?: { name: string; href: string };
  cards: EnrichedCard[];
  total: number;
  searchHref: string;
  subLinks?: { name: string; href: string; n: number }[];
  ads: AdBanner[];
  crumbs: { name: string; url: string }[];
}) {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${place} berberleri`,
    itemListElement: cards.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteUrl()}/berber/${c.slug}`, name: c.name })),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${siteUrl()}${c.url}` })),
  };
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pb-12 pt-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      <nav aria-label="Konum" className="flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
        {crumbs.slice(0, -1).map((c) => (
          <span key={c.url} className="flex items-center gap-1.5">
            <Link href={c.url} className="hover:text-stone-900">
              {c.name}
            </Link>
            <span aria-hidden>›</span>
          </span>
        ))}
        <span className="text-stone-700">{crumbs.at(-1)!.name}</span>
      </nav>
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">{place} Berberleri ve Online Randevu</h1>
        <p className="text-stone-600">
          {total > 0
            ? `${place} bölgesindeki ${total} berberin hizmetlerini, fiyatlarını ve müşteri yorumlarını karşılaştırın. Boş saatleri anında görün, birkaç adımda online randevu alın; ödeme dükkanda yapılır.`
            : `${place} bölgesinde henüz platformda berber yok. Yakındaki diğer bölgelere göz atabilir ya da berberiniz katılsın diye ona Dijital Berber'i önerebilirsiniz.`}
        </p>
      </header>
      {cards.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-stone-900">{place} berberleri</h2>
            {total > cards.length && (
              <Link href={searchHref} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
                Tümü ({total}) <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
          <CardGrid cards={cards} ads={ads} adEvery={6} />
        </section>
      )}
      {subLinks && subLinks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">{place} ilçelerinde berberler</h2>
          <ul className="flex flex-wrap gap-2">
            {subLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 hover:border-stone-400">
                  {l.name} <span className="ml-1.5 text-stone-500">({l.n})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {parent && (
        <p className="text-sm text-stone-600">
          Diğer bölgeler:{" "}
          <Link href={parent.href} className="font-medium text-stone-900 underline underline-offset-4">
            {parent.name} berberleri
          </Link>
        </p>
      )}
    </main>
  );
}
