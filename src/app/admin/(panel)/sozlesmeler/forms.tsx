"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

export function NewContractForm({ action }: { action: Action }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sözleşme adı" name="title" error={fe?.title} required>
          <Input id="title" name="title" maxLength={120} placeholder="İşletme Hizmet Sözleşmesi" />
        </Field>
        <Field label="Kod" name="code" error={fe?.code} hint="Sistem içi kısa ad" required>
          <Input id="code" name="code" maxLength={60} placeholder="hizmet-sozlesmesi" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Oluştur</SubmitButton>
      </div>
    </form>
  );
}

export function PublishVersionForm({ action, defaultContent, isFirst }: { action: Action; defaultContent: string; isFirst: boolean }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form
      onSubmit={(e) => {
        if (!window.confirm("Yeni sürüm yayınlanacak ve tüm işletmelere bildirim gönderilecek. Devam edilsin mi?")) return e.preventDefault();
        onSubmit(e);
      }}
      noValidate
      className="space-y-4"
    >
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <Field label="Sözleşme metni" name="content" error={fe?.content} hint="Paragrafları boş satırla ayırın." required>
        <Textarea id="content" name="content" rows={16} defaultValue={defaultContent} className="font-[inherit] leading-relaxed" />
      </Field>
      {!isFirst && (
        <Field label="Değişiklik notu" name="changeNote" error={fe?.changeNote} hint="İşletmelere bildirimde gösterilir (örn. iptal koşulları güncellendi).">
          <Input id="changeNote" name="changeNote" maxLength={300} />
        </Field>
      )}
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingText="Yayınlanıyor…">
          {isFirst ? "Yayınla" : "Yeni sürümü yayınla"}
        </SubmitButton>
      </div>
    </form>
  );
}
