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
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Paket adı" name={`name`} error={fe?.name} required>
          <Input name="name" id="name" defaultValue={defaults?.name} placeholder="Premium Plus" maxLength={60} />
        </Field>
        <Field label="Kod" name="code" error={fe?.code} hint="Sistem içi kısa ad" required>
          <Input name="code" id="code" defaultValue={defaults?.code} placeholder="premium-plus" maxLength={40} />
        </Field>
        <Field label="Aylık ücret (TL)" name="monthlyPriceKurus" error={fe?.monthlyPriceKurus} required>
          <Input name="monthlyPriceKurus" id="monthlyPriceKurus" inputMode="decimal" defaultValue={kurusToInput(defaults?.monthlyPriceKurus)} placeholder="900" />
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

export function CampaignForm({ action, defaults }: { action: Action; defaults: { earlyLimit: number; earlyTrialMonths: number; defaultTrialMonths: number } }) {
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
  plans: { id: string; name: string; monthlyPriceKurus: number; isActive: boolean }[];
  defaults: { planId: string; monthlyFeeKurus: number; trialMonths: number; note: string | null };
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  const currentPlan = plans.find((p) => p.id === defaults.planId);
  const customFee = currentPlan && currentPlan.monthlyPriceKurus !== defaults.monthlyFeeKurus ? kurusToInput(defaults.monthlyFeeKurus) : "";
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Paket" name="planId" error={fe?.planId}>
          <Select name="planId" id="planId" defaultValue={defaults.planId}>
            {plans
              .filter((p) => p.isActive || p.id === defaults.planId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({kurusToInput(p.monthlyPriceKurus)} TL)
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Özel aylık ücret (TL)" name="customFee" error={fe?.customFee} hint="Boş bırakılırsa paket fiyatı uygulanır.">
          <Input name="customFee" id="customFee" inputMode="decimal" defaultValue={customFee} placeholder="Paket fiyatı" />
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

export function PaymentForm({ action, feeKurus, today }: { action: Action; feeKurus: number; today: string }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Result state={state} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Ay" name="months" error={fe?.months}>
          <Input name="months" id="months" type="number" min={1} max={36} defaultValue={1} />
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
