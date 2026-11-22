import Link from "next/link";
import { Award, Clock, MapPin, Star } from "lucide-react";
import type { EnrichedCard } from "@/server/modules/marketplace/search";
import { formatTL } from "@/lib/money";
import { cn } from "@/lib/cn";

export function Stars({ value, count, size = "sm" }: { value: number; count: number; size?: "sm" | "md" }) {
  if (!count) return <span className="text-xs text-stone-500">Henüz yorum yok</span>;
  return (
    <span className={cn("inline-flex items-center gap-1", size === "md" ? "text-sm" : "text-xs")} aria-label={`${value.toFixed(1)} puan, ${count} yorum`}>
      <Star className={cn("fill-accent-500 text-accent-500", size === "md" ? "size-4" : "size-3.5")} aria-hidden />
      <span className="font-medium text-stone-900">{value.toFixed(1)}</span>
      <span className="text-stone-500">({count})</span>
    </span>
  );
}

export function BusinessCardView({ c }: { c: EnrichedCard }) {
  return (
    <Link href={`/berber/${c.slug}`} className="group block overflow-hidden rounded-3xl border border-stone-200/80 bg-white transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] bg-stone-100">
        {c.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-stone-100 to-stone-200 text-3xl font-semibold text-stone-300">{c.name.slice(0, 1)}</div>
        )}
        {c.awardMonth && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-stone-800 shadow-sm">
            <Award className="size-3.5 text-accent-600" aria-hidden /> Ayın İşletmesi
          </span>
        )}
        <span
          className={cn(
            "absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm",
            c.open.isOpen ? "bg-emerald-700 text-white" : "bg-white/95 text-stone-600",
          )}
        >
          {c.open.isOpen ? "Açık" : "Kapalı"}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start gap-3">
          {c.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-stone-900 group-hover:text-accent-600">{c.name}</p>
            <p className="flex items-center gap-1 truncate text-sm text-stone-500">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {c.district}, {c.province}
              {c.distanceKm != null && <span> · {c.distanceKm < 1 ? `${Math.round(c.distanceKm * 1000)} m` : `${c.distanceKm.toFixed(1)} km`}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Stars value={c.ratingAvg} count={c.ratingCount} />
          {c.minPriceKurus != null && <span className="text-xs text-stone-500">{formatTL(c.minPriceKurus)}’den başlayan</span>}
        </div>
        <p className={cn("flex items-center gap-1.5 text-xs", c.nextFree ? "text-emerald-700" : "text-stone-500")}>
          <Clock className="size-3.5" aria-hidden />
          {c.nextFree ? `Bugün ilk boş saat: ${c.nextFree}` : "Bugün boş saat yok"}
        </p>
      </div>
    </Link>
  );
}

export type AdBanner = { id: string; title: string; subtitle: string | null; imageUrl: string; buttonText: string | null };

/** İşletme listelerinin arasındaki reklam alanı. "Reklam" etiketiyle açıkça ayrılır; tıklama /r/<id> üzerinden sayılır. */
export function AdCard({ ad }: { ad: AdBanner }) {
  return (
    <a
      href={`/r/${ad.id}`}
      rel="sponsored noopener"
      className="group relative col-span-full block overflow-hidden rounded-3xl border border-stone-200/80 bg-brand-900"
    >
      <div className="relative aspect-[16/7] sm:aspect-[4/1]">
        <span className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-stone-700">Reklam</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ad.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/75 via-stone-950/35 to-transparent" />
        <div className="absolute inset-y-0 left-0 flex max-w-lg flex-col justify-center gap-1.5 p-5 text-white sm:p-8">
          <p className="text-lg font-semibold leading-snug tracking-tight sm:text-2xl">{ad.title}</p>
          {ad.subtitle && <p className="line-clamp-2 text-sm text-white/85">{ad.subtitle}</p>}
          {ad.buttonText && (
            <span className="mt-1 inline-flex w-fit items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-stone-900">{ad.buttonText}</span>
          )}
        </div>
      </div>
    </a>
  );
}

/** Kart ızgarası; reklam verilirse her `adEvery` karttan sonra sıradaki reklam eklenir (sonda değil, her reklam bir kez). */
export function CardGrid({ cards, ads = [], adEvery = 6 }: { cards: EnrichedCard[]; ads?: AdBanner[]; adEvery?: number }) {
  const items: React.ReactNode[] = [];
  cards.forEach((c, i) => {
    items.push(<BusinessCardView key={c.id} c={c} />);
    const n = i + 1;
    // Her reklam sayfada en fazla bir kez
    const ad = n % adEvery === 0 && n < cards.length ? ads[n / adEvery - 1] : undefined;
    if (ad) items.push(<AdCard key={`ad-${ad.id}`} ad={ad} />);
  });
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items}</div>;
}
