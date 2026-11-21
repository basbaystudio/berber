"use client";

import { CreditCard, Landmark } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

export function MethodForm({ action, current }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; current: "CARD" | "BANK_TRANSFER" }) {
  const { state, pending, onSubmit } = useFormAction(action);
  const opts = [
    { v: "CARD", label: "Kartla otomatik ödeme", desc: "Aylık ücret her ay kartınızdan otomatik çekilir.", Icon: CreditCard },
    { v: "BANK_TRANSFER", label: "Havale / EFT", desc: "Her ay ödemeyi kendiniz yaparsınız.", Icon: Landmark },
  ] as const;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Ödeme yöntemi">
        {opts.map(({ v, label, desc, Icon }) => (
          <label key={v} className={cn("flex cursor-pointer gap-3 rounded-2xl border p-4 has-[:checked]:border-stone-900", "border-stone-200")}>
            <input type="radio" name="method" value={v} defaultChecked={current === v} className="mt-1 accent-stone-900" />
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
