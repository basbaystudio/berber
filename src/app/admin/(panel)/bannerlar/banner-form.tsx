"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, SubmitButton } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { useFormAction } from "@/components/ui/use-action";

export type BannerDefaults = {
  title: string;
  subtitle: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  imageUrl: string;
};

export function BannerForm({ action, defaults }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; defaults?: BannerDefaults }) {
  const isNew = !defaults;
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: isNew });
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <ImageInput
          key={isNew && state.status === "success" ? Math.random() : "img"}
          currentUrl={defaults?.imageUrl}
          aspect="aspect-[12/5]"
          error={fe?.file}
          label="Banner görseli seç (önerilen 2400×1000)"
          required={isNew}
        />
      </div>
      <div className="space-y-4">
        {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
        {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
        <Field label="Başlık" name="title" error={fe?.title} required>
          <Input id="title" name="title" defaultValue={defaults?.title} maxLength={80} />
        </Field>
        <Field label="Alt başlık" name="subtitle" error={fe?.subtitle}>
          <Input id="subtitle" name="subtitle" defaultValue={defaults?.subtitle ?? ""} maxLength={160} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Buton yazısı" name="buttonText" error={fe?.buttonText}>
            <Input id="buttonText" name="buttonText" defaultValue={defaults?.buttonText ?? ""} maxLength={30} placeholder="Hemen keşfet" />
          </Field>
          <Field label="Bağlantı" name="linkUrl" error={fe?.linkUrl} hint="Örn. /ara veya https://…">
            <Input id="linkUrl" name="linkUrl" defaultValue={defaults?.linkUrl ?? ""} maxLength={500} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Yayın başlangıcı" name="startsAt" error={fe?.startsAt} hint="Boşsa hemen">
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={defaults?.startsAt} />
          </Field>
          <Field label="Yayın bitişi" name="endsAt" error={fe?.endsAt} hint="Boşsa süresiz">
            <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={defaults?.endsAt} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Checkbox name="isActive" defaultChecked={defaults?.isActive ?? true} label="Aktif" />
            <label className="flex items-center gap-2 text-sm text-stone-600">
              Sıra
              <Input name="sortOrder" type="number" min={0} max={999} defaultValue={defaults?.sortOrder ?? 0} className="w-20" />
            </label>
          </div>
          <SubmitButton pending={pending} pendingText="Yükleniyor…">
            {isNew ? "Banner ekle" : "Kaydet"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
