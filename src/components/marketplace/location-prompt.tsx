"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LocateFixed, MapPin } from "lucide-react";

const COOKIE = "konum";

function setCookie(value: string, maxAge: number) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
}

/**
 * Konum paylaşımı: tarayıcıdan izin istenir, koordinat yalnızca bu cihazdaki çereze yazılır (30 gün).
 * Sunucuda saklanmaz; "Konumu unut" ile silinir.
 */
export function LocationPrompt({ mode }: { mode: "ASK" | "REFINE" | "FORGET" }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  const share = () => {
    setMsg(null);
    if (!navigator.geolocation) return setMsg("Tarayıcınız konum özelliğini desteklemiyor.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCookie(`${p.coords.latitude.toFixed(3)},${p.coords.longitude.toFixed(3)}`, 60 * 60 * 24 * 30);
        setBusy(false);
        start(() => router.refresh());
      },
      () => {
        setBusy(false);
        setMsg("Konum izni verilmedi. Aramadan il seçerek berber bulabilirsiniz.");
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };
  const forget = () => {
    setCookie("", 0);
    start(() => router.refresh());
  };

  if (mode === "FORGET") {
    return (
      <button type="button" onClick={forget} className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline">
        Konumu unut
      </button>
    );
  }
  if (mode === "REFINE") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" onClick={share} disabled={busy} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 disabled:opacity-60">
          <LocateFixed className="size-4" aria-hidden /> {busy ? "Konum alınıyor…" : "Tam konumumu kullan"}
        </button>
        {msg && <span className="text-xs text-amber-800">{msg}</span>}
      </span>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl border border-stone-200/80 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-stone-100 text-stone-700">
          <MapPin className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-medium text-stone-900">Yakınındaki berberleri görelim</p>
          <p className="text-sm text-stone-500">Konumunu paylaşırsan sana en yakın berberleri önerelim. Konumun yalnızca bu cihazda saklanır.</p>
          {msg && <p className="mt-1 text-sm text-amber-800">{msg}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        <LocateFixed className="size-4" aria-hidden /> {busy ? "Konum alınıyor…" : "Konumumu paylaş"}
      </button>
    </div>
  );
}
