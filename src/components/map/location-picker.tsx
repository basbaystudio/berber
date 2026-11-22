"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

const MapView = dynamic(() => import("./location-picker-map"), {
  ssr: false,
  loading: () => <div className="grid h-72 place-items-center rounded-lg border border-stone-200 bg-stone-100 text-sm text-stone-500">Harita yükleniyor…</div>,
});

type GeocodeFn = (q: { address: string; district?: string; province?: string }) => Promise<{ lat: number; lng: number; precision: "ADDRESS" | "DISTRICT" } | null>;

/** Seçili <option> yazısı (il/ilçe adı). */
function selectedText(id: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  return el && el.value ? el.options[el.selectedIndex]?.text.trim() : undefined;
}

/**
 * Konum seçimi: adres girilince otomatik bulunur (geocode verilirse), haritaya tıklayarak ya da elle enlem/boylam
 * girerek düzeltilebilir. Değerler form alanı olarak gönderilir.
 * Otomatik bulma, elle seçilmiş bir konumun üzerine yazmaz (o durumda "Adresten bul" düğmesi kullanılır).
 */
export function LocationPicker({
  defaultLat,
  defaultLng,
  errors,
  geocode,
  addressFieldId = "addressLine",
  provinceFieldId = "provinceId",
  districtFieldId = "districtId",
}: {
  defaultLat?: number | null;
  defaultLng?: number | null;
  errors?: { latitude?: string; longitude?: string };
  geocode?: GeocodeFn;
  addressFieldId?: string;
  provinceFieldId?: string;
  districtFieldId?: string;
}) {
  const [lat, setLat] = useState(defaultLat != null ? String(defaultLat) : "");
  const [lng, setLng] = useState(defaultLng != null ? String(defaultLng) : "");
  const [geoError, setGeoError] = useState<string | null>(null);
  const latN = Number(lat.replace(",", "."));
  const lngN = Number(lng.replace(",", "."));
  const value = lat && lng && Number.isFinite(latN) && Number.isFinite(lngN) ? { lat: latN, lng: lngN } : null;

  const [geoInfo, setGeoInfo] = useState<string | null>(null);
  const [finding, startFinding] = useTransition();
  // Konum boşsa ya da en son adresten otomatik bulunduysa, adres değişince yeniden bulunabilir
  const autoRef = useRef(defaultLat == null);
  const lastQuery = useRef("");

  const setPoint = (p: { lat: number; lng: number }) => {
    setLat(p.lat.toFixed(6));
    setLng(p.lng.toFixed(6));
  };
  const pick = (p: { lat: number; lng: number }) => {
    autoRef.current = false;
    setGeoInfo(null);
    setPoint(p);
  };

  const findFromAddress = useCallback(
    (force: boolean) => {
      if (!geocode) return;
      if (!force && !autoRef.current) return;
      const address = (document.getElementById(addressFieldId) as HTMLTextAreaElement | HTMLInputElement | null)?.value.trim() ?? "";
      const district = selectedText(districtFieldId);
      const province = selectedText(provinceFieldId);
      if (address.length < 3 || !district) {
        if (force) setGeoInfo("Önce il, ilçe ve açık adresi girin.");
        return;
      }
      const key = [address, district, province].join("|");
      if (!force && key === lastQuery.current) return;
      lastQuery.current = key;
      startFinding(async () => {
        const r = await geocode({ address, district, province });
        // Arama sürerken elle konum seçildiyse ya da adres değiştiyse geç gelen sonucu uygulama
        if ((!force && !autoRef.current) || lastQuery.current !== key) return;
        if (!r) {
          setGeoInfo("Adres haritada bulunamadı. Haritaya tıklayarak işaretleyin.");
          return;
        }
        autoRef.current = true;
        setPoint(r);
        setGeoInfo(
          r.precision === "ADDRESS"
            ? "Konum adresten bulundu. Gerekirse haritaya tıklayarak düzeltin."
            : "Tam adres bulunamadı, ilçe merkezi işaretlendi. Lütfen haritaya tıklayarak dükkanın yerini düzeltin.",
        );
      });
    },
    [geocode, addressFieldId, districtFieldId, provinceFieldId],
  );

  // Adres alanından çıkınca ya da ilçe değişince otomatik bul
  useEffect(() => {
    if (!geocode) return;
    const addr = document.getElementById(addressFieldId);
    const dist = document.getElementById(districtFieldId);
    const onChange = () => findFromAddress(false);
    addr?.addEventListener("blur", onChange);
    dist?.addEventListener("change", onChange);
    return () => {
      addr?.removeEventListener("blur", onChange);
      dist?.removeEventListener("change", onChange);
    };
  }, [geocode, addressFieldId, districtFieldId, findFromAddress]);

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
        <p className="text-sm text-stone-600">
          {geocode ? "Adres girilince konum otomatik işaretlenir; düzeltmek için haritaya tıklayın." : "İşletmenin yerini haritada işaretlemek için haritaya tıklayın."}
        </p>
        <div className="flex flex-wrap gap-2">
          {geocode && (
            <Button variant="outline" size="sm" onClick={() => findFromAddress(true)} disabled={finding}>
              <MapPin className="size-4" aria-hidden /> {finding ? "Aranıyor…" : "Adresten bul"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={useMyLocation}>
            <LocateFixed className="size-4" aria-hidden /> Bulunduğum konum
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => (setLat(""), setLng(""), (autoRef.current = true), setGeoInfo(null))}>
              Konumu temizle
            </Button>
          )}
        </div>
      </div>
      {geoError && <p className="text-sm text-amber-800">{geoError}</p>}
      {geoInfo && (
        <p className="text-sm text-stone-600" role="status">
          {geoInfo}
        </p>
      )}
      <MapView value={value} onPick={pick} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Enlem" name="latitude" error={errors?.latitude}>
          <Input id="latitude" name="latitude" inputMode="decimal" value={lat} onChange={(e) => ((autoRef.current = false), setLat(e.target.value))} placeholder="41.015137" />
        </Field>
        <Field label="Boylam" name="longitude" error={errors?.longitude}>
          <Input id="longitude" name="longitude" inputMode="decimal" value={lng} onChange={(e) => ((autoRef.current = false), setLng(e.target.value))} placeholder="28.979530" />
        </Field>
      </div>
    </div>
  );
}
