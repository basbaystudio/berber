"use client";

import type { ActionState } from "@/server/lib/action";
import type { WeeklyRanges } from "@/lib/schedule";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { useFormAction } from "@/components/ui/use-action";
import { WeeklyEditor } from "@/components/panel/weekly-editor";
import { formatTL } from "@/lib/money";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

function Result({ state }: { state: ActionState }) {
  if (state.status === "error") return <Alert tone="error">{state.message}</Alert>;
  if (state.status === "success" && state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function NewStaffForm({ action }: { action: Action }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad soyad" name="name" error={fe?.name} required>
          <Input id="name" name="name" maxLength={60} />
        </Field>
        <Field label="Ünvan" name="title" error={fe?.title}>
          <Input id="title" name="title" maxLength={60} placeholder="Örn. Usta berber" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Çalışan ekle</SubmitButton>
      </div>
    </form>
  );
}

export function StaffInfoForm({ action, defaults }: { action: Action; defaults: { name: string; title: string | null; bio: string | null; isActive: boolean } }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad soyad" name="name" error={fe?.name} required>
          <Input id="name" name="name" defaultValue={defaults.name} maxLength={60} />
        </Field>
        <Field label="Ünvan" name="title" error={fe?.title}>
          <Input id="title" name="title" defaultValue={defaults.title ?? ""} maxLength={60} />
        </Field>
      </div>
      <Field label="Kısa tanıtım" name="bio" error={fe?.bio}>
        <Textarea id="bio" name="bio" rows={3} maxLength={500} defaultValue={defaults.bio ?? ""} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox name="isActive" defaultChecked={defaults.isActive} label="Aktif (pasif çalışan randevu almaz)" />
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function StaffPhotoForm({ action, currentUrl }: { action: Action; currentUrl: string | null }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Result state={state} />
      <div className="max-w-40">
        <ImageInput currentUrl={currentUrl} aspect="aspect-square" label="Fotoğraf seç" error={fe?.file} maxSide={1200} />
      </div>
      <SubmitButton pending={pending} variant="outline" pendingText="Yükleniyor…">
        Fotoğrafı yükle
      </SubmitButton>
    </form>
  );
}

export function StaffServicesForm({
  action,
  services,
  selected,
}: {
  action: Action;
  services: { id: string; name: string; priceKurus: number; durationMin: number; isActive: boolean }[];
  selected: string[];
}) {
  const { state, pending, onSubmit } = useFormAction(action);
  if (!services.length) return <p className="text-sm text-stone-500">Önce Hizmetler sayfasından hizmet ekleyin.</p>;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Result state={state} />
      <div className="grid gap-2 sm:grid-cols-2">
        {services.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200/80 px-3 py-2.5 text-sm hover:bg-stone-50 has-[:checked]:border-stone-400">
            <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={selected.includes(s.id)} className="size-4 accent-stone-900" />
            <span className="flex-1">
              <span className="block text-stone-900">{s.name}</span>
              <span className="text-xs text-stone-500">
                {s.durationMin} dk · {formatTL(s.priceKurus)}
                {!s.isActive && " · pasif"}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Hizmetleri kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function StaffWeeklyForm({
  action,
  defaultValue,
  kind,
  businessHours,
}: {
  action: Action;
  defaultValue: WeeklyRanges;
  kind: "shifts" | "breaks";
  businessHours?: WeeklyRanges;
}) {
  const { state, pending, onSubmit } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Result state={state} />
      <WeeklyEditor
        name="weekly"
        defaultValue={defaultValue}
        activeLabel={kind === "shifts" ? "Çalışıyor" : "Mola var"}
        emptyLabel={kind === "shifts" ? "İzinli" : "Yok"}
        defaultRange={kind === "shifts" ? { start: "09:00", end: "19:00" } : { start: "13:00", end: "13:45" }}
        copySource={businessHours ? { label: "İşletme saatlerini kopyala", value: businessHours } : undefined}
      />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>{kind === "shifts" ? "Vardiyayı kaydet" : "Molaları kaydet"}</SubmitButton>
      </div>
    </form>
  );
}

export function TimeOffForm({ action }: { action: Action }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Başlangıç" name="startsAt" error={fe?.startsAt} required>
          <Input id="startsAt" name="startsAt" type="datetime-local" />
        </Field>
        <Field label="Bitiş" name="endsAt" error={fe?.endsAt} required>
          <Input id="endsAt" name="endsAt" type="datetime-local" />
        </Field>
        <Field label="Tür" name="kind" id="kindOff">
          <Select id="kindOff" name="kind" defaultValue="LEAVE">
            <option value="LEAVE">İzin</option>
            <option value="SICK">Rapor</option>
            <option value="BLOCK">Saat kapatma</option>
          </Select>
        </Field>
      </div>
      <Field label="Not" name="note" id="offNote" error={fe?.note}>
        <Input id="offNote" name="note" maxLength={120} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>İzin ekle</SubmitButton>
      </div>
    </form>
  );
}
