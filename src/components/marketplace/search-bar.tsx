"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocateFixed, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Ana sayfa arama çubuğu: işletme adı + il, ya da konumla yakındakiler. */
export function SearchBar({ provinces }: { provinces: { id: number; name: string }[] }) {
  const router = useRouter();
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const nearMe = () => {
    setGeoMsg(null);
    if (!navigator.geolocation) return setGeoMsg("Tarayıcınız konum özelliğini desteklemiyor.");
    navigator.geolocation.getCurrentPosition(
      (p) => router.push(`/ara?lat=${p.coords.latitude.toFixed(5)}&lng=${p.coords.longitude.toFixed(5)}&sirala=yakin`),
      () => setGeoMsg("Konum izni verilmedi. İl seçerek arayabilirsiniz."),
      { timeout: 10000 },
    );
  };
  return (
    <div className="space-y-2">
      <form action="/ara" className="flex flex-col gap-2 rounded-3xl border border-stone-200/80 bg-white p-2 sm:flex-row" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Berber adı</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input name="q" placeholder="Berber adı" className="h-12 w-full rounded-2xl bg-transparent pl-11 pr-3 text-sm focus:outline-none" />
        </label>
        <label className="sm:w-52">
          <span className="sr-only">İl</span>
          <select name="il" defaultValue="" className="h-12 w-full rounded-2xl bg-stone-50 px-3 text-sm focus:outline-none">
            <option value="">Tüm Türkiye</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="lg" className="h-12 rounded-2xl">
          Ara
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-3 px-2">
        <button type="button" onClick={nearMe} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
          <LocateFixed className="size-4" aria-hidden /> Yakınımdaki berberler
        </button>
        {geoMsg && <span className="text-xs text-amber-700">{geoMsg}</span>}
      </div>
    </div>
  );
}
