"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/components/ui/image-compress";
import { cn } from "@/lib/cn";

type Kind = "INTERIOR" | "EXTERIOR";
type Photo = { id: string; kind: string; url: string; uploadedBy: string };
const KIND_LABEL: Record<Kind, string> = { EXTERIOR: "Dış cephe", INTERIOR: "İç mekân" };

/**
 * Dükkan fotoğrafları yönetimi (yönetici ve işletme panelinde ortak). Dosyalar tarayıcıda küçültülüp sırayla gönderilir;
 * limit sunucuda kesin olarak uygulanır.
 */
export function ShopPhotosManager({
  photos,
  limit,
  upload,
  remove,
  setKind,
  move,
}: {
  photos: Photo[];
  limit: number;
  upload: (fd: FormData) => Promise<ActionState<{ used: number }>>;
  remove: (id: string) => Promise<ActionState>;
  setKind: (id: string, kind: Kind) => Promise<ActionState>;
  move: (id: string, dir: "up" | "down") => Promise<ActionState>;
}) {
  const inputs = { EXTERIOR: useRef<HTMLInputElement>(null), INTERIOR: useRef<HTMLInputElement>(null) };
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [messages, setMessages] = useState<{ tone: "success" | "error"; text: string }[]>([]);
  const [pending, start] = useTransition();
  const remaining = Math.max(0, limit - photos.length);

  async function onFiles(kind: Kind, files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const out: typeof messages = [];
    if (list.length > remaining) out.push({ tone: "error", text: `Kalan hak ${remaining} fotoğraf; yalnızca ilk ${remaining} tanesi yüklenecek.` });
    const queue = list.slice(0, remaining);
    let ok = 0;
    setBusy({ done: 0, total: queue.length });
    for (const [i, file] of queue.entries()) {
      const fd = new FormData();
      fd.set("file", await compressImage(file, 2000));
      fd.set("kind", kind);
      const r = await upload(fd);
      if (r.status === "error") {
        out.push({ tone: "error", text: `${file.name}: ${r.message}` });
        if (r.message.includes("limit")) break;
      } else ok++;
      setBusy({ done: i + 1, total: queue.length });
    }
    if (ok) out.unshift({ tone: "success", text: `${ok} fotoğraf yüklendi.` });
    setMessages(out);
    setBusy(null);
    const el = inputs[kind].current;
    if (el) el.value = "";
  }

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      setMessages(r.status === "error" ? [{ tone: "error", text: r.message }] : []);
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {(["EXTERIOR", "INTERIOR"] as const).map((k) => (
          <label
            key={k}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:border-stone-400",
              (busy || remaining === 0) && "pointer-events-none opacity-60",
            )}
          >
            <ImagePlus className="size-4" aria-hidden />
            {KIND_LABEL[k]} fotoğrafı ekle
            <input
              ref={inputs[k]}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="sr-only"
              disabled={!!busy || remaining === 0}
              onChange={(e) => onFiles(k, e.target.files)}
            />
          </label>
        ))}
        <span className="text-sm tabular-nums text-stone-500">
          {photos.length}/{limit} fotoğraf
        </span>
        {busy && (
          <span className="inline-flex items-center gap-2 text-sm text-stone-600">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Yükleniyor {busy.done}/{busy.total}
          </span>
        )}
      </div>
      {messages.map((m, i) => (
        <Alert key={i} tone={m.tone}>
          {m.text}
        </Alert>
      ))}
      {photos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
          Henüz dükkan fotoğrafı yok. Önce dış cephe, sonra iç mekân fotoğraflarını ekleyin; müşteriler dükkanı tanıyarak gelsin.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="relative aspect-[4/3] bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={KIND_LABEL[p.kind as Kind]} className="size-full object-cover" loading="lazy" />
                <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-stone-800">{KIND_LABEL[p.kind as Kind]}</span>
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <select
                  aria-label="Fotoğraf türü"
                  value={p.kind}
                  disabled={pending}
                  onChange={(e) => run(() => setKind(p.id, e.target.value as Kind))}
                  className="h-8 min-w-0 rounded-lg border border-stone-200 bg-white px-1.5 text-xs"
                >
                  <option value="EXTERIOR">Dış cephe</option>
                  <option value="INTERIOR">İç mekân</option>
                </select>
                <div className="flex shrink-0 items-center">
                  <Button variant="ghost" size="sm" aria-label="Öne al" disabled={pending || i === 0} onClick={() => run(() => move(p.id, "up"))}>
                    <ArrowLeft className="size-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Arkaya al" disabled={pending || i === photos.length - 1} onClick={() => run(() => move(p.id, "down"))}>
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Sil"
                    disabled={pending}
                    onClick={() => {
                      if (confirm("Fotoğraf silinecek. Emin misiniz?")) run(() => remove(p.id));
                    }}
                  >
                    <Trash2 className="size-4 text-red-600" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-stone-500">İlk fotoğraf profilde en başta görünür; okları kullanarak sıralayabilirsiniz.</p>
    </div>
  );
}
