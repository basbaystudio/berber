"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

const MapView = dynamic(() => import("./location-picker-map"), {
  ssr: false,
  loading: () => <div className="grid h-72 place-items-center rounded-lg border border-stone-200 bg-stone-100 text-sm text-stone-500">Harita yükleniyor…</div>,
});

/** Haritaya tıklayarak ya da elle enlem/boylam girerek konum seçimi. Değerler form alanı olarak gönderilir. */
export function LocationPicker({
  defaultLat,
  defaultLng,
  errors,
}: {
  defaultLat?: number | null;
  defaultLng?: number | null;
  errors?: { latitude?: string; longitude?: string };
}) {
  const [lat, setLat] = useState(defaultLat != null ? String(defaultLat) : "");
  const [lng, setLng] = useState(defaultLng != null ? String(defaultLng) : "");
  const [geoError, setGeoError] = useState<string | null>(null);
  const latN = Number(lat.replace(",", "."));
  const lngN = Number(lng.replace(",", "."));
  const value = lat && lng && Number.isFinite(latN) && Number.isFinite(lngN) ? { lat: latN, lng: lngN } : null;

  const pick = (p: { lat: number; lng: number }) => {
    setLat(p.lat.toFixed(6));
    setLng(p.lng.toFixed(6));
  };

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) return setGeoError("Tarayıcınız konum özelliğini desteklemiyor.");
    navigator.geolocation.getCurrentPosition(
      (pos) => pick({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError("Konum alınamadı. Haritaya tıklayarak seçebilirsiniz."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">İşletmenin yerini haritada işaretlemek için haritaya tıklayın.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={useMyLocation}>
            <LocateFixed className="size-4" aria-hidden /> Bulunduğum konum
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => (setLat(""), setLng(""))}>
              Konumu temizle
            </Button>
          )}
        </div>
      </div>
      {geoError && <p className="text-sm text-amber-700">{geoError}</p>}
      <MapView value={value} onPick={pick} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Enlem" name="latitude" error={errors?.latitude}>
          <Input id="latitude" name="latitude" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="41.015137" />
        </Field>
        <Field label="Boylam" name="longitude" error={errors?.longitude}>
          <Input id="longitude" name="longitude" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="28.979530" />
        </Field>
      </div>
    </div>
  );
}
