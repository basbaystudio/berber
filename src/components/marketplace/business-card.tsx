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

export function CardGrid({ cards }: { cards: EnrichedCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <BusinessCardView key={c.id} c={c} />
      ))}
    </div>
  );
}
