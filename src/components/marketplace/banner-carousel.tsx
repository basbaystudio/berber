"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  buttonText: string | null;
};

/** Sade banner alanı: kaydırarak geçiş (otomatik dönme yok), noktalar ve oklarla gezinme. */
export function BannerCarousel({ banners }: { banners: HomeBanner[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!banners.length) return null;

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const next = (i + banners.length) % banners.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section aria-label="Kampanyalar ve duyurular" aria-roledescription="carousel" className="relative">
      <div
        ref={ref}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b, i) => (
          <div key={b.id} className="relative w-full shrink-0 snap-start" aria-roledescription="slide" aria-label={`${i + 1} / ${banners.length}`}>
            <div className="relative aspect-[4/3] w-full sm:aspect-[12/5]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt="" className="absolute inset-0 size-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent sm:bg-gradient-to-r sm:from-stone-950/65 sm:via-stone-950/25" />
              <div className="absolute inset-x-0 bottom-0 max-w-xl space-y-3 p-6 text-white sm:inset-y-0 sm:flex sm:flex-col sm:justify-center sm:p-12">
                <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{b.title}</h2>
                {b.subtitle && <p className="text-sm text-white/85 sm:text-base">{b.subtitle}</p>}
                {b.linkUrl && b.buttonText && (
                  <div className="pt-1">
                    <a
                      href={`/r/${b.id}`}
                      className="inline-flex h-10 items-center rounded-xl bg-white px-5 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100"
                    >
                      {b.buttonText}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <>
          <div className="absolute bottom-4 right-6 flex gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`${i + 1}. banner`}
                aria-current={i === index}
                className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80")}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-3 sm:flex">
            <button type="button" onClick={() => go(index - 1)} aria-label="Önceki" className="pointer-events-auto grid size-9 place-items-center rounded-full bg-white/80 text-stone-800 backdrop-blur hover:bg-white">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Sonraki" className="pointer-events-auto grid size-9 place-items-center rounded-full bg-white/80 text-stone-800 backdrop-blur hover:bg-white">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
