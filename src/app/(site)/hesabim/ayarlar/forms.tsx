"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { formatTrPhone } from "@/lib/phone";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;
const Result = ({ s }: { s: ActionState }) => (s.status === "error" ? <Alert tone="error">{s.message}</Alert> : s.status === "success" && s.message ? <Alert tone="success">{s.message}</Alert> : null);

export function ProfileForm({ action, defaults }: { action: Action; defaults: { name: string; phone: string; marketing: boolean } }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result s={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad soyad" name="name" error={fe?.name} required>
          <Input id="name" name="name" defaultValue={defaults.name} maxLength={80} />
        </Field>
        <Field label="Cep telefonu" name="phone" error={fe?.phone} required>
          <Input id="phone" name="phone" type="tel" defaultValue={formatTrPhone(defaults.phone)} />
        </Field>
      </div>
      <Checkbox name="marketing" defaultChecked={defaults.marketing} label="Kampanya ve duyuru e-postaları almak istiyorum." />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result s={state} />
      <Field label="Mevcut şifre" name="currentPassword" error={fe?.currentPassword} required>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Yeni şifre" name="newPassword" error={fe?.newPassword} required>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Yeni şifre (tekrar)" name="confirmPassword" error={fe?.confirmPassword} required>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Şifreyi değiştir</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteForm({ action }: { action: Action }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result s={state} />
      <p className="text-sm text-stone-600">Hesabınız silindiğinde kişisel bilgileriniz anonimleştirilir ve bu işlem geri alınamaz. Yaklaşan randevularınız varsa önce iptal etmelisiniz.</p>
      <Field label="Şifreniz" name="password" id="deletePassword" error={fe?.password} required>
        <Input id="deletePassword" name="password" type="password" autoComplete="current-password" />
      </Field>
      <Checkbox name="confirm" label="Hesabımın kalıcı olarak silineceğini anlıyorum." />
      {fe?.confirm && <p className="text-sm text-red-600">{fe.confirm}</p>}
      <SubmitButton pending={pending} variant="danger">
        Hesabımı sil
      </SubmitButton>
    </form>
  );
}
