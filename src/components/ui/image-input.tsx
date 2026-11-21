"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { compressImage } from "./image-compress";

/**
 * Görsel seçme alanı: seçilen dosyayı tarayıcıda küçültür ve forma küçültülmüş haliyle koyar, önizleme gösterir.
 * Form gönderildiğinde dosya `name` alanıyla gider.
 */
export function ImageInput({
  name = "file",
  currentUrl,
  aspect = "aspect-video",
  maxSide = 2400,
  error,
  label = "Görsel seç",
  required,
}: {
  name?: string;
  currentUrl?: string | null;
  aspect?: string;
  maxSide?: number;
  error?: string;
  label?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const small = await compressImage(file, maxSide);
    const dt = new DataTransfer();
    dt.items.add(small);
    if (inputRef.current) inputRef.current.files = dt.files;
    setPreview(URL.createObjectURL(small));
    setBusy(false);
  }

  return (
    <div className="space-y-1.5">
      <label
        className={cn(
          "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-stone-50 text-sm text-stone-500 transition-colors hover:bg-stone-100",
          aspect,
          error ? "border-red-400" : "border-stone-300",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Önizleme" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 p-4 text-center">
            <ImagePlus className="size-6 text-stone-400" aria-hidden />
            {label}
            <span className="text-xs text-stone-400">JPEG, PNG veya WebP</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-white/70">
            <Loader2 className="size-5 animate-spin text-stone-600" aria-label="Hazırlanıyor" />
          </span>
        )}
        <input ref={inputRef} type="file" name={name} accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onChange} required={required && !currentUrl} />
      </label>
      {preview && <p className="text-xs text-stone-500">Değiştirmek için görsele tıklayın.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
