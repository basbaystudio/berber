"use client";

import dynamic from "next/dynamic";

const Inner = dynamic(() => import("./static-map-inner"), {
  ssr: false,
  loading: () => <div className="grid h-64 place-items-center rounded-2xl bg-stone-100 text-sm text-stone-500">Harita yükleniyor…</div>,
});

export function StaticMap({ lat, lng }: { lat: number; lng: number }) {
  return <Inner lat={lat} lng={lng} />;
}
