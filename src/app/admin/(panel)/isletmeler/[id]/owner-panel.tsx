"use client";

import type { ActionState } from "@/server/lib/action";
import { ActionButton } from "@/components/ui/action-button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { CredentialsBox } from "../business-form";

export function OwnerPanel({
  owner,
  slug,
  updateAction,
  resetAction,
}: {
  owner: { name: string; login: string; isActive: boolean };
  slug: string;
  updateAction: (p: ActionState, fd: FormData) => Promise<ActionState>;
  resetAction: () => Promise<ActionState<{ login: string; tempPassword: string }>>;
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(updateAction);
  return (
    <div className="space-y-6 p-5">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
        {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Yetkili adı soyadı" name="ownerName" error={fe?.ownerName} required>
            <Input id="ownerName" name="ownerName" defaultValue={owner.name} maxLength={80} />
          </Field>
          <Field label="Kullanıcı adı" name="login" error={fe?.login} hint="Değiştirilirse işletmenin açık oturumları kapanır." required>
            <Input id="login" name="login" defaultValue={owner.login} autoCapitalize="none" spellCheck={false} maxLength={64} />
          </Field>
        </div>
        <Checkbox name="isActive" defaultChecked={owner.isActive} label="Hesap aktif (pasif hesap panele giriş yapamaz)" />
        <div className="flex justify-end">
          <SubmitButton pending={pending}>Hesabı kaydet</SubmitButton>
        </div>
      </form>
      <div className="border-t border-stone-100 pt-5">
        <p className="mb-2 text-sm text-stone-600">
          Şifresini unutan işletme için yeni geçici şifre üretin. Mevcut şifre ve açık oturumlar geçersiz olur.
        </p>
        <ActionButton
          action={resetAction}
          confirm="Yeni geçici şifre üretilecek ve işletmenin mevcut şifresi geçersiz olacak. Devam edilsin mi?"
          pendingText="Şifre üretiliyor…"
          render={(d) => <CredentialsBox login={d.login} tempPassword={d.tempPassword} slug={slug} />}
        >
          Geçici şifre üret
        </ActionButton>
      </div>
    </div>
  );
}
