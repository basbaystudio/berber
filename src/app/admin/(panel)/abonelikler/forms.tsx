"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { kurusToInput } from "@/lib/money";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

function Result({ state }: { state: ActionState }) {
  if (state.status === "error") return <Alert tone="error">{state.message}</Alert>;
  if (state.status === "success" && state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export type PlanDefaults = {
  name: string;
  code: string;
  description: string | null;
  monthlyPriceKurus: number;
  yearlyPriceKurus: number | null;
  highlights: string[];
  isActive: boolean;
  sortOrder: number;
};

export function PlanForm({ action, defaults }: { action: Action; defaults?: PlanDefaults }) {
  const isNew = !defaults;
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: isNew });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Paket adı" name={`name`} error={fe?.name} required>
          <Input name="name" id="name" defaultValue={defaults?.name} placeholder="Premium Plus" maxLength={60} />
        </Field>
        <Field label="Kod" name="code" error={fe?.code} hint="Sistem içi kısa ad" required>
          <Input name="code" id="code" defaultValue={defaults?.code} placeholder="premium-plus" maxLength={40} />
        </Field>
        <Field label="Aylık ücret (TL)" name="monthlyPriceKurus" error={fe?.monthlyPriceKurus} required>
          <Input name="monthlyPriceKurus" id="monthlyPriceKurus" inputMode="decimal" defaultValue={kurusToInput(defaults?.monthlyPriceKurus)} placeholder="699,90" />
        </Field>
        <Field label="Yıllık ücret (TL)" name="yearlyPriceKurus" error={fe?.yearlyPriceKurus} hint="Boşsa yıllık seçenek sunulmaz.">
          <Input name="yearlyPriceKurus" id="yearlyPriceKurus" inputMode="decimal" defaultValue={kurusToInput(defaults?.yearlyPriceKurus ?? undefined)} placeholder="6.990" />
        </Field>
      </div>
      <Field label="Açıklama" name="description" error={fe?.description}>
        <Input name="description" id="description" defaultValue={defaults?.description ?? ""} maxLength={500} />
      </Field>
      <Field label="Öne çıkan özellikler" name="highlights" error={fe?.highlights} hint="Her satıra bir madde yazın.">
        <Textarea name="highlights" id="highlights" rows={3} defaultValue={defaults?.highlights.join("\n")} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Checkbox name="isActive" defaultChecked={defaults?.isActive ?? true} label="Aktif" />
          <label className="flex items-center gap-2 text-sm text-stone-600">
            Sıra
            <Input name="sortOrder" type="number" min={0} max={999} defaultValue={defaults?.sortOrder ?? 0} className="w-20" />
          </label>
        </div>
        <SubmitButton pending={pending}>{isNew ? "Paketi ekle" : "Kaydet"}</SubmitButton>
      </div>
    </form>
  );
}

export function CampaignForm({
  action,
  defaults,
}: {
  action: Action;
  defaults: { earlyLimit: number; earlyTrialMonths: number; defaultTrialMonths: number; graceDays: number };
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Kampanyalı işletme sayısı" name="earlyLimit" error={fe?.earlyLimit} hint="İlk kaç işletme">
          <Input name="earlyLimit" id="earlyLimit" type="number" min={0} defaultValue={defaults.earlyLimit} />
        </Field>
        <Field label="Kampanya deneme süresi (ay)" name="earlyTrialMonths" error={fe?.earlyTrialMonths}>
          <Input name="earlyTrialMonths" id="earlyTrialMonths" type="number" min={0} max={36} defaultValue={defaults.earlyTrialMonths} />
        </Field>
        <Field label="Diğer işletmeler deneme süresi (ay)" name="defaultTrialMonths" error={fe?.defaultTrialMonths}>
          <Input name="defaultTrialMonths" id="defaultTrialMonths" type="number" min={0} max={36} defaultValue={defaults.defaultTrialMonths} />
        </Field>
      </div>
      <Field label="Ödeme gecikmesinde askıya alma (gün)" name="graceDays" error={fe?.graceDays} hint="Gecikmenin ilk günü size ve işletmeye e-posta gider; bu gün sayısına ulaşınca işletme otomatik askıya alınır.">
        <Input name="graceDays" id="graceDays" type="number" min={1} max={60} defaultValue={defaults.graceDays} className="max-w-32" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function SubscriptionForm({
  action,
  plans,
  defaults,
}: {
  action: Action;
  plans: { id: string; name: string; monthlyPriceKurus: number; yearlyPriceKurus: number | null; isActive: boolean }[];
  defaults: { planId: string; monthlyFeeKurus: number; yearlyFeeKurus: number | null; trialMonths: number; note: string | null };
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  const currentPlan = plans.find((p) => p.id === defaults.planId);
  const customFee = currentPlan && currentPlan.monthlyPriceKurus !== defaults.monthlyFeeKurus ? kurusToInput(defaults.monthlyFeeKurus) : "";
  const customYearlyFee =
    currentPlan && defaults.yearlyFeeKurus != null && currentPlan.yearlyPriceKurus !== defaults.yearlyFeeKurus ? kurusToInput(defaults.yearlyFeeKurus) : "";
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Paket" name="planId" error={fe?.planId}>
          <Select name="planId" id="planId" defaultValue={defaults.planId}>
            {plans
              .filter((p) => p.isActive || p.id === defaults.planId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({kurusToInput(p.monthlyPriceKurus)} TL/ay{p.yearlyPriceKurus != null ? ` · ${kurusToInput(p.yearlyPriceKurus)} TL/yıl` : ""})
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Özel aylık ücret (TL)" name="customFee" error={fe?.customFee} hint="Boş bırakılırsa paket fiyatı uygulanır.">
          <Input name="customFee" id="customFee" inputMode="decimal" defaultValue={customFee} placeholder="Paket fiyatı" />
        </Field>
        <Field label="Özel yıllık ücret (TL)" name="customYearlyFee" error={fe?.customYearlyFee} hint="Boşsa paketin yıllık fiyatı.">
          <Input name="customYearlyFee" id="customYearlyFee" inputMode="decimal" defaultValue={customYearlyFee} placeholder="Paket fiyatı" />
        </Field>
        <Field label="Ücretsiz deneme (ay)" name="trialMonths" error={fe?.trialMonths}>
          <Input name="trialMonths" id="trialMonths" type="number" min={0} max={36} defaultValue={defaults.trialMonths} />
        </Field>
      </div>
      <Field label="Not" name="note" error={fe?.note}>
        <Input name="note" id="note" defaultValue={defaults.note ?? ""} maxLength={500} placeholder="Örn. özel anlaşma" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Aboneliği kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function PaymentForm({ action, feeKurus, months = 1, today }: { action: Action; feeKurus: number; months?: number; today: string }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Ay" name="months" error={fe?.months}>
          <Input name="months" id="months" type="number" min={1} max={36} defaultValue={months} />
        </Field>
        <Field label="Tutar (TL)" name="amount" error={fe?.amount}>
          <Input name="amount" id="amount" inputMode="decimal" defaultValue={kurusToInput(feeKurus)} />
        </Field>
        <Field label="Yöntem" name="method" error={fe?.method}>
          <Select name="method" id="method" defaultValue="BANK_TRANSFER">
            <option value="BANK_TRANSFER">Havale / EFT</option>
            <option value="CARD">Kart</option>
            <option value="CASH">Nakit</option>
            <option value="OTHER">Diğer</option>
          </Select>
        </Field>
        <Field label="Ödeme tarihi" name="paidOn" error={fe?.paidOn}>
          <Input name="paidOn" id="paidOn" type="date" defaultValue={today} max={today} />
        </Field>
      </div>
      <Field label="Not" name="note" id="paymentNote" error={fe?.note}>
        <Input name="note" id="paymentNote" maxLength={500} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Ödemeyi kaydet</SubmitButton>
      </div>
    </form>
  );
}

/** Ödemeye PDF fatura yükleme (küçük satır içi form). */
export function InvoiceUploadForm({ action, hasInvoice }: { action: Action; hasInvoice: boolean }) {
  const { state, pending, onSubmit, version } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2" key={version}>
      <input
        type="file"
        name="file"
        accept="application/pdf"
        aria-label="Fatura PDF dosyası"
        className="max-w-56 text-xs text-stone-600 file:mr-2 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:text-stone-700"
      />
      <SubmitButton pending={pending} size="sm" variant="outline" pendingText="Yükleniyor…">
        {hasInvoice ? "Faturayı değiştir" : "Fatura yükle"}
      </SubmitButton>
      {state.status === "error" && <span className="text-xs text-red-600">{state.message}</span>}
      {state.status === "success" && <span className="text-xs text-emerald-700">{state.message}</span>}
    </form>
  );
}
