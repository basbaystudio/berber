"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

type Loc = { id: number; name: string; districts: { id: number; name: string }[] };

const sel = "h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm";

/** Arama filtreleri (GET formu; sunucu tarafında doğrulanır). */
export function SearchFilters({ locations, types, values }: { locations: Loc[]; types: { name: string; slug: string }[]; values: Record<string, string | undefined> }) {
  const [il, setIl] = useState(values.il ?? "");
  const [coords, setCoords] = useState<{ lat?: string; lng?: string }>({ lat: values.lat, lng: values.lng });
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const districts = locations.find((p) => String(p.id) === il)?.districts ?? [];
  return (
    <form action="/ara" className="space-y-4 text-sm" role="search">
      <label className="block space-y-1">
        <span className="text-stone-600">Berber adı</span>
        <input name="q" defaultValue={values.q} className={sel} />
      </label>
      <label className="block space-y-1">
        <span className="text-stone-600">İl</span>
        <select name="il" value={il} onChange={(e) => setIl(e.target.value)} className={sel}>
          <option value="">Tümü</option>
          {locations.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-stone-600">İlçe</span>
        <select name="ilce" defaultValue={values.ilce ?? ""} key={il} disabled={!il} className={sel}>
          <option value="">{il ? "Tümü" : "Önce il seçin"}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-stone-600">Hizmet</span>
        <select name="hizmet" defaultValue={values.hizmet ?? ""} className={sel}>
          <option value="">Tümü</option>
          {types.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-1">
        <legend className="text-stone-600">Fiyat aralığı (TL)</legend>
        <div className="flex gap-2">
          <input name="fiyatMin" type="number" min={0} defaultValue={values.fiyatMin} placeholder="En az" aria-label="En az fiyat" className={sel} />
          <input name="fiyatMax" type="number" min={0} defaultValue={values.fiyatMax} placeholder="En çok" aria-label="En çok fiyat" className={sel} />
        </div>
      </fieldset>
      <label className="block space-y-1">
        <span className="text-stone-600">En az puan</span>
        <select name="puan" defaultValue={values.puan ?? ""} className={sel}>
          <option value="">Fark etmez</option>
          <option value="4.5">4,5 ve üzeri</option>
          <option value="4">4 ve üzeri</option>
          <option value="3">3 ve üzeri</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-stone-700">
        <input type="checkbox" name="bugun" value="1" defaultChecked={values.bugun === "1"} className="size-4 accent-brand-900" /> Yalnızca bugün müsait olanlar
      </label>
      <label className="block space-y-1">
        <span className="text-stone-600">Sırala</span>
        <select name="sirala" defaultValue={values.sirala ?? "onerilen"} className={sel}>
          <option value="onerilen">Önerilen</option>
          <option value="puan">En yüksek puan</option>
          <option value="fiyat">En düşük fiyat</option>
          <option value="yakin" disabled={!coords.lat}>
            En yakın {coords.lat ? "" : "(konum gerekli)"}
          </option>
        </select>
      </label>
      {coords.lat && <input type="hidden" name="lat" value={coords.lat} />}
      {coords.lng && <input type="hidden" name="lng" value={coords.lng} />}
      <button
        type="button"
        onClick={() =>
          navigator.geolocation?.getCurrentPosition(
            (p) => setCoords({ lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) }),
            () => setGeoMsg("Konum izni verilmedi."),
          )
        }
        className="inline-flex items-center gap-1.5 text-stone-600 hover:text-stone-900"
      >
        <LocateFixed className="size-4" aria-hidden /> {coords.lat ? "Konum kullanılıyor" : "Konumumu kullan"}
      </button>
      {geoMsg && <p className="text-xs text-amber-700">{geoMsg}</p>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Uygula
        </Button>
        <ButtonLink href="/ara" variant="ghost">
          Temizle
        </ButtonLink>
      </div>
    </form>
  );
}
