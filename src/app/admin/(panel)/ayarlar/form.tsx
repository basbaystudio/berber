"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

export function ContactForm({
  action,
  defaults,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  defaults: { email: string; phone: string; alertEmail: string };
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="İletişim e-postası" name="email" error={fe?.email} hint="İşletmelerin size ulaşacağı adres (işletme panelinde ve e-postalarda gösterilir).">
          <Input id="email" name="email" type="email" defaultValue={defaults.email} autoCapitalize="none" />
        </Field>
        <Field label="İletişim telefonu" name="phone" error={fe?.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} placeholder="0850 000 00 00" />
        </Field>
      </div>
      <Field label="Yönetici bildirim e-postası" name="alertEmail" error={fe?.alertEmail} hint="Ödeme gecikmesi ve askıya alma bildirimleri buraya gelir. Boşsa tüm yöneticilerin e-posta adreslerine gönderilir.">
        <Input id="alertEmail" name="alertEmail" type="email" defaultValue={defaults.alertEmail} autoCapitalize="none" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function BankForm({
  action,
  defaults,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  defaults: { bankName: string; accountName: string; iban: string };
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Banka" name="bankName" error={fe?.bankName}>
          <Input id="bankName" name="bankName" defaultValue={defaults.bankName} />
        </Field>
        <Field label="Hesap sahibi" name="accountName" error={fe?.accountName}>
          <Input id="accountName" name="accountName" defaultValue={defaults.accountName} />
        </Field>
      </div>
      <Field label="IBAN" name="iban" error={fe?.iban}>
        <Input id="iban" name="iban" defaultValue={defaults.iban} placeholder="TR00 0000 0000 0000 0000 0000 00" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function LegalForm({ action, defaults }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; defaults: { customerPrivacy: string; terms: string } }) {
  const { state, pending, onSubmit } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <Field label="KVKK Aydınlatma Metni (müşteriler)" name="customerPrivacy" hint="Kayıt ekranında onaylatılır; /kvkk-aydinlatma adresinde yayınlanır.">
        <Textarea id="customerPrivacy" name="customerPrivacy" rows={8} defaultValue={defaults.customerPrivacy} />
      </Field>
      <Field label="Kullanım Koşulları" name="terms" hint="/kullanim-kosullari adresinde yayınlanır.">
        <Textarea id="terms" name="terms" rows={8} defaultValue={defaults.terms} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}
