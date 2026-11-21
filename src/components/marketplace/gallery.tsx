"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Photo = { id: string; url: string; caption: string | null; categoryId: string | null };

/** Kategori filtreli galeri + tam ekran görüntüleyici (klavye ile gezinme). */
export function Gallery({ photos, categories }: { photos: Photo[]; categories: { id: string; name: string }[] }) {
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const list = cat ? photos.filter((p) => p.categoryId === cat) : photos;

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % list.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + list.length) % list.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, list.length]);

  return (
    <div className="space-y-3">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[{ id: null, name: "Tümü" }, ...categories].map((c) => (
            <button
              key={c.id ?? "all"}
              type="button"
              onClick={() => setCat(c.id)}
              className={cn("rounded-full px-3 py-1 text-sm", cat === c.id ? "bg-brand-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200")}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {list.map((p, i) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(i)} className="block aspect-square w-full overflow-hidden rounded-xl bg-stone-100" aria-label={p.caption ?? `Fotoğraf ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ""} loading="lazy" className="size-full object-cover transition-transform hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && list[open] && (
        <div className="fixed inset-0 z-50 flex flex-col bg-stone-950/95" role="dialog" aria-modal="true" aria-label="Fotoğraf görüntüleyici">
          <div className="flex justify-end p-3">
            <button type="button" onClick={() => setOpen(null)} className="rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Kapat">
              <X className="size-6" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-12 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={list[open].url} alt={list[open].caption ?? ""} className="max-h-full max-w-full rounded-lg object-contain" />
            {list.length > 1 && (
              <>
                <button type="button" onClick={() => setOpen((open - 1 + list.length) % list.length)} className="absolute left-2 rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Önceki">
                  <ChevronLeft className="size-7" />
                </button>
                <button type="button" onClick={() => setOpen((open + 1) % list.length)} className="absolute right-2 rounded-full p-2 text-white/80 hover:bg-white/10" aria-label="Sonraki">
                  <ChevronRight className="size-7" />
                </button>
              </>
            )}
          </div>
          {list[open].caption && <p className="px-6 pb-6 text-center text-sm text-white/80">{list[open].caption}</p>}
        </div>
      )}
    </div>
  );
}
