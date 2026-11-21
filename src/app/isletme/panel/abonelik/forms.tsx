"use client";

import { CreditCard, Landmark } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { formatTL } from "@/lib/money";

export function MethodForm({ action, current }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; current: "CARD" | "BANK_TRANSFER" }) {
  const { state, pending, onSubmit } = useFormAction(action);
  const opts = [
    { v: "CARD", label: "Kartla otomatik ödeme", desc: "Ücret her dönem kartınızdan otomatik çekilir.", Icon: CreditCard },
    { v: "BANK_TRANSFER", label: "Havale / EFT", desc: "Her dönem ödemeyi kendiniz yaparsınız.", Icon: Landmark },
  ] as const;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Ödeme yöntemi">
        {opts.map(({ v, label, desc, Icon }) => (
          <label key={v} className={cn("flex cursor-pointer gap-3 rounded-2xl border p-4 has-[:checked]:border-brand-900", "border-stone-200")}>
            <input type="radio" name="method" value={v} defaultChecked={current === v} className="mt-1 accent-brand-900" />
            <span>
              <span className="flex items-center gap-2 font-medium text-stone-900">
                <Icon className="size-4 text-stone-500" aria-hidden /> {label}
              </span>
              <span className="mt-1 block text-sm text-stone-500">{desc}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Ödeme yöntemini kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function CycleForm({
  action,
  current,
  monthlyKurus,
  yearlyKurus,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  current: "MONTHLY" | "YEARLY";
  monthlyKurus: number;
  yearlyKurus: number;
}) {
  const { state, pending, onSubmit } = useFormAction(action);
  const saving = monthlyKurus * 12 - yearlyKurus;
  const opts = [
    { v: "MONTHLY", label: "Aylık", price: `${formatTL(monthlyKurus)} / ay`, note: "İstediğiniz zaman yıllığa geçebilirsiniz." },
    { v: "YEARLY", label: "Yıllık", price: `${formatTL(yearlyKurus)} / yıl`, note: saving > 0 ? `Aylığa göre yılda ${formatTL(saving)} tasarruf` : "12 ay tek ödeme" },
  ] as const;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Ödeme dönemi">
        {opts.map(({ v, label, price, note }) => (
          <label key={v} className="flex cursor-pointer gap-3 rounded-2xl border border-stone-200 p-4 has-[:checked]:border-brand-900">
            <input type="radio" name="cycle" value={v} defaultChecked={current === v} className="mt-1 accent-brand-900" />
            <span>
              <span className="block font-medium text-stone-900">{label}</span>
              <span className="mt-0.5 block text-sm tabular-nums text-stone-700">{price}</span>
              <span className="mt-1 block text-sm text-stone-500">{note}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-sm text-stone-500">Değişiklik bir sonraki ödemeden itibaren geçerli olur; ödenmiş döneminiz etkilenmez.</p>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Ödeme dönemini kaydet</SubmitButton>
      </div>
    </form>
  );
}
