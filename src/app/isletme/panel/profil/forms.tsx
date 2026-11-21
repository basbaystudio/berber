"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { useFormAction } from "@/components/ui/use-action";
import { formatTrPhone } from "@/lib/phone";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

export function ProfileForm({ action, defaults }: { action: Action; defaults: { phone: string; description: string | null } }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <Field label="Telefon" name="phone" error={fe?.phone} required>
        <Input id="phone" name="phone" type="tel" defaultValue={formatTrPhone(defaults.phone)} />
      </Field>
      <Field label="İşletme tanıtımı" name="description" error={fe?.description} hint="Profilinizde görünür. En fazla 1000 karakter.">
        <Textarea id="description" name="description" rows={5} maxLength={1000} defaultValue={defaults.description ?? ""} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function ImageUploadForm({ action, currentUrl, aspect, label }: { action: Action; currentUrl: string | null; aspect: string; label: string }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <ImageInput currentUrl={currentUrl} aspect={aspect} label={label} error={fe?.file} maxSide={2000} />
      <SubmitButton pending={pending} variant="outline" pendingText="Yükleniyor…">
        Yükle
      </SubmitButton>
    </form>
  );
}
