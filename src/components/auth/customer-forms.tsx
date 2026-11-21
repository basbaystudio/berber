"use client";

import Link from "next/link";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

export function CustomerLoginForm({ action, next }: { action: Action; next: string }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Field label="E-posta" name="identifier" error={fe?.identifier} required>
        <Input id="identifier" name="identifier" type="email" autoComplete="email" autoCapitalize="none" />
      </Field>
      <Field label="Şifre" name="password" error={fe?.password} required>
        <Input id="password" name="password" type="password" autoComplete="current-password" />
      </Field>
      <div className="flex justify-end">
        <Link href="/sifremi-unuttum" className="text-sm text-stone-500 hover:text-stone-900">
          Şifremi unuttum
        </Link>
      </div>
      <SubmitButton pending={pending} className="w-full" pendingText="Giriş yapılıyor…">
        Giriş yap
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ action, next }: { action: Action; next: string }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Field label="Ad soyad" name="name" error={fe?.name} required>
        <Input id="name" name="name" autoComplete="name" maxLength={80} />
      </Field>
      <Field label="E-posta" name="email" error={fe?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" />
      </Field>
      <Field label="Cep telefonu" name="phone" error={fe?.phone} hint="Randevunuzla ilgili işletme size ulaşabilsin diye." required>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="0532 123 45 67" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Şifre" name="password" error={fe?.password} hint="En az 8 karakter, harf ve rakam" required>
          <Input id="password" name="password" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Şifre (tekrar)" name="passwordConfirm" error={fe?.passwordConfirm} required>
          <Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" />
        </Field>
      </div>
      <div className="space-y-2">
        <Checkbox
          name="kvkk"
          label={
            <span>
              <Link href="/kvkk-aydinlatma" target="_blank" className="underline underline-offset-4">
                KVKK Aydınlatma Metni
              </Link>{" "}
              ve{" "}
              <Link href="/kullanim-kosullari" target="_blank" className="underline underline-offset-4">
                Kullanım Koşulları
              </Link>
              ’nı okudum, kabul ediyorum.
            </span>
          }
        />
        {fe?.kvkk && <p className="text-sm text-red-600">{fe.kvkk}</p>}
        <Checkbox name="marketing" label="Kampanya ve duyurulardan e-posta ile haberdar olmak istiyorum (isteğe bağlı)." />
      </div>
      <SubmitButton pending={pending} className="w-full" pendingText="Hesap oluşturuluyor…">
        Kayıt ol
      </SubmitButton>
    </form>
  );
}

export function ForgotForm({ action }: { action: Action }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  if (state.status === "success") return <Alert tone="success">{state.message}</Alert>;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Field label="E-posta" name="email" error={fe?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" />
      </Field>
      <SubmitButton pending={pending} className="w-full">
        Sıfırlama bağlantısı gönder
      </SubmitButton>
    </form>
  );
}

export function ResetForm({ action, token }: { action: Action; token: string }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Field label="Yeni şifre" name="password" error={fe?.password} hint="En az 8 karakter, harf ve rakam" required>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Yeni şifre (tekrar)" name="passwordConfirm" error={fe?.passwordConfirm} required>
        <Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton pending={pending} className="w-full">
        Şifremi güncelle
      </SubmitButton>
    </form>
  );
}
