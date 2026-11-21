"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

export function ChangePasswordForm({ action }: { action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Field label="Mevcut (geçici) şifre" name="currentPassword" error={fe?.currentPassword} required>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" aria-invalid={!!fe?.currentPassword} />
      </Field>
      <Field label="Yeni şifre" name="newPassword" error={fe?.newPassword} hint="En az 8 karakter, en az bir harf ve bir rakam." required>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" aria-invalid={!!fe?.newPassword} />
      </Field>
      <Field label="Yeni şifre (tekrar)" name="confirmPassword" error={fe?.confirmPassword} required>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!fe?.confirmPassword} />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingText="Kaydediliyor…">
        Şifreyi kaydet
      </SubmitButton>
    </form>
  );
}
