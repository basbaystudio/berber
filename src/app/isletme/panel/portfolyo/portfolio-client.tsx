"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { compressImage } from "@/components/ui/image-compress";
import { useButtonAction, useFormAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

type Opt = { id: string; name: string };
type Photo = { id: string; url: string; caption: string | null; categoryId: string | null; staffId: string | null };

/** Çoklu fotoğraf yükleme: her dosya tarayıcıda küçültülür ve sırayla gönderilir. Limit sunucuda kesin olarak uygulanır. */
export function Uploader({
  action,
  remaining,
  categories,
  staff,
}: {
  action: (fd: FormData) => Promise<ActionState<{ used: number }>>;
  remaining: number;
  categories: Opt[];
  staff: Opt[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [messages, setMessages] = useState<{ tone: "success" | "error"; text: string }[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [staffId, setStaffId] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const out: typeof messages = [];
    if (list.length > remaining) out.push({ tone: "error", text: `Kalan hakkınız ${remaining} fotoğraf; yalnızca ilk ${remaining} tanesi yüklenecek.` });
    const queue = list.slice(0, Math.max(0, remaining));
    let ok = 0;
    setBusy({ done: 0, total: queue.length });
    for (const [i, file] of queue.entries()) {
      const fd = new FormData();
      fd.set("file", await compressImage(file, 2000));
      if (categoryId) fd.set("categoryId", categoryId);
      if (staffId) fd.set("staffId", staffId);
      const r = await action(fd);
      if (r.status === "error") {
        out.push({ tone: "error", text: `${file.name}: ${r.message}` });
        if (r.message.includes("limit")) break;
      } else ok++;
      setBusy({ done: i + 1, total: queue.length });
    }
    if (ok) out.unshift({ tone: "success", text: `${ok} fotoğraf yüklendi.` });
    setMessages(out);
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const full = remaining <= 0;
  return (
    <div className="space-y-4">
      {messages.map((m, i) => (
        <Alert key={i} tone={m.tone}>
          {m.text}
        </Alert>
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kategori (isteğe bağlı)" name="upCategory">
          <Select id="upCategory" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Kategorisiz</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Çalışan (isteğe bağlı)" name="upStaff">
          <Select id="upStaff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Belirtilmedi</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center text-sm transition-colors",
          full ? "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400" : "cursor-pointer border-stone-300 bg-stone-50 text-stone-600 hover:bg-stone-100",
        )}
      >
        {busy ? (
          <>
            <Loader2 className="size-6 animate-spin text-stone-500" aria-hidden />
            Yükleniyor… {busy.done}/{busy.total}
          </>
        ) : full ? (
          <>
            <ImagePlus className="size-6" aria-hidden />
            Fotoğraf limitiniz doldu. Yeni fotoğraf için önce bir fotoğrafı silin.
          </>
        ) : (
          <>
            <ImagePlus className="size-6 text-stone-400" aria-hidden />
            Fotoğraf seçin (birden fazla seçebilirsiniz)
            <span className="text-xs text-stone-400">JPEG, PNG veya WebP · kalan hak: {remaining}</span>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={full || !!busy}
          onChange={(e) => onFiles(e.target.files)}
          aria-label="Portfolyo fotoğrafı seç"
        />
      </label>
    </div>
  );
}

export function PhotoCard({
  photo,
  index,
  total,
  categories,
  staff,
  actions,
}: {
  photo: Photo;
  index: number;
  total: number;
  categories: Opt[];
  staff: Opt[];
  actions: {
    meta: (p: ActionState, fd: FormData) => Promise<ActionState>;
    replace: (p: ActionState, fd: FormData) => Promise<ActionState>;
    remove: () => Promise<ActionState>;
    up: () => Promise<ActionState>;
    down: () => Promise<ActionState>;
  };
}) {
  const [open, setOpen] = useState(false);
  const meta = useFormAction(actions.meta);
  const replace = useFormAction(actions.replace);
  const remove = useButtonAction(actions.remove);
  const [, moveDispatch, moving] = useActionState(async (_: null, dir: "up" | "down") => {
    await (dir === "up" ? actions.up() : actions.down());
    return null;
  }, null);
  const cat = categories.find((c) => c.id === photo.categoryId)?.name;
  const st = staff.find((s) => s.id === photo.staffId)?.name;

  return (
    <li className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
      <div className="relative aspect-square bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption ?? "Portfolyo fotoğrafı"} className="size-full object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs text-stone-700">{index + 1}</span>
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 min-h-10 text-sm text-stone-700">{photo.caption || <span className="text-stone-400">Açıklama yok</span>}</p>
        <p className="truncate text-xs text-stone-500">{[cat, st].filter(Boolean).join(" · ") || " "}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Kapat" : "Düzenle"}
          </Button>
          <span className="flex-1" />
          <button type="button" disabled={index === 0 || moving} onClick={() => startTransition(() => moveDispatch("up"))} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30" aria-label="Öne taşı">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" disabled={index === total - 1 || moving} onClick={() => startTransition(() => moveDispatch("down"))} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30" aria-label="Sona taşı">
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            disabled={remove.pending}
            onClick={() => window.confirm("Fotoğraf silinsin mi?") && remove.run()}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-700"
            aria-label="Sil"
          >
            {remove.pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>
        {remove.state.status === "error" && <Alert tone="error">{remove.state.message}</Alert>}
        {open && (
          <div className="space-y-4 border-t border-stone-100 pt-3">
            <form onSubmit={meta.onSubmit} className="space-y-3">
              {meta.state.status === "error" && <Alert tone="error">{meta.state.message}</Alert>}
              {meta.state.status === "success" && <p className="text-xs text-emerald-700">{meta.state.message}</p>}
              <Input name="caption" defaultValue={photo.caption ?? ""} maxLength={200} placeholder="Açıklama" aria-label="Açıklama" />
              <Select name="categoryId" defaultValue={photo.categoryId ?? ""} aria-label="Kategori">
                <option value="">Kategorisiz</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select name="staffId" defaultValue={photo.staffId ?? ""} aria-label="Çalışan">
                <option value="">Çalışan belirtilmedi</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <SubmitButton pending={meta.pending} size="sm" className="w-full">
                Kaydet
              </SubmitButton>
            </form>
            <form onSubmit={replace.onSubmit} className="space-y-2">
              {replace.state.status === "error" && <Alert tone="error">{replace.state.message}</Alert>}
              {replace.state.status === "success" && <p className="text-xs text-emerald-700">{replace.state.message}</p>}
              <ImageInput aspect="aspect-video" label="Yeni görsel seç" maxSide={2000} />
              <SubmitButton pending={replace.pending} size="sm" variant="outline" className="w-full" pendingText="Yükleniyor…">
                Görseli değiştir
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}

export function Categories({
  categories,
  create,
  remove,
}: {
  categories: Opt[];
  create: (p: ActionState, fd: FormData) => Promise<ActionState>;
  remove: Record<string, () => Promise<ActionState>>;
}) {
  const { state, pending, onSubmit, fieldErrors } = useFormAction(create, { resetOnSuccess: true });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.length === 0 && <span className="text-sm text-stone-500">Henüz kategori yok.</span>}
        {categories.map((c) => (
          <CategoryChip key={c.id} name={c.name} remove={remove[c.id]!} />
        ))}
      </div>
      <form onSubmit={onSubmit} noValidate className="flex gap-2">
        <Input name="name" placeholder="Yeni kategori (örn. Sakal)" maxLength={40} aria-label="Yeni kategori" aria-invalid={!!fieldErrors?.name} />
        <SubmitButton pending={pending} variant="outline">
          Ekle
        </SubmitButton>
      </form>
      {state.status === "error" && <p className="text-sm text-red-600">{fieldErrors?.name ?? state.message}</p>}
    </div>
  );
}

function CategoryChip({ name, remove }: { name: string; remove: () => Promise<ActionState> }) {
  const r = useButtonAction(remove);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm text-stone-700">
      {name}
      <button
        type="button"
        onClick={() => window.confirm(`“${name}” kategorisi silinsin mi? Fotoğraflar kategorisiz kalır.`) && r.run()}
        className="rounded-full p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-800"
        aria-label={`${name} kategorisini sil`}
      >
        {r.pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      </button>
    </span>
  );
}
