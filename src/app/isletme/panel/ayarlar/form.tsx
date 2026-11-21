"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

export function BookingSettingsForm({
  action,
  defaults,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  defaults: { slotIntervalMin: number; minLeadMin: number; maxAdvanceDays: number; bufferMin: number };
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Saat aralığı" name="slotIntervalMin" error={fe?.slotIntervalMin} hint="Müşteriye gösterilen başlangıç saatleri bu aralıkla listelenir.">
          <Select id="slotIntervalMin" name="slotIntervalMin" defaultValue={String(defaults.slotIntervalMin)}>
            {[5, 10, 15, 20, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} dakika
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Randevular arası tampon (dk)" name="bufferMin" error={fe?.bufferMin} hint="Temizlik/hazırlık için her randevudan sonra boş bırakılır.">
          <Input id="bufferMin" name="bufferMin" type="number" min={0} max={120} step={5} defaultValue={defaults.bufferMin} />
        </Field>
        <Field label="En erken online randevu (dk önce)" name="minLeadMin" error={fe?.minLeadMin} hint="Örn. 60: müşteriler en erken 1 saat sonrasına randevu alabilir.">
          <Input id="minLeadMin" name="minLeadMin" type="number" min={0} max={10080} step={15} defaultValue={defaults.minLeadMin} />
        </Field>
        <Field label="En fazla kaç gün ileriye" name="maxAdvanceDays" error={fe?.maxAdvanceDays}>
          <Input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={defaults.maxAdvanceDays} />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Kaydet</SubmitButton>
      </div>
    </form>
  );
}
