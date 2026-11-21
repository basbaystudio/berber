"use client";

import { useState } from "react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/action-button";
import { useFormAction } from "@/components/ui/use-action";
import { SlotPicker } from "@/components/panel/slot-picker";
import type { PublicSlots } from "@/app/(site)/berber/actions";

export function ManageAppointment({
  cancel,
  reschedule,
  fetchSlots,
  serviceIds,
  packageId,
  staffId,
  today,
  defaultDate,
}: {
  cancel: () => Promise<ActionState>;
  reschedule: (p: ActionState, fd: FormData) => Promise<ActionState>;
  fetchSlots: (i: { date: string; serviceIds: string[]; packageId?: string; staffId?: string | null }) => Promise<PublicSlots>;
  serviceIds: string[];
  packageId?: string;
  staffId: string;
  today: string;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const r = useFormAction(reschedule);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Vazgeç" : "Saati değiştir"}
        </Button>
        <ActionButton action={cancel} variant="dangerOutline" confirm="Randevunuz iptal edilsin mi?">
          İptal et
        </ActionButton>
      </div>
      {open && (
        <form onSubmit={r.onSubmit} className="space-y-3 rounded-2xl bg-stone-50 p-4">
          {r.state.status === "error" && <Alert tone="error">{r.state.message}</Alert>}
          {r.state.status === "success" && <Alert tone="success">{r.state.message}</Alert>}
          <SlotPicker fetchSlots={fetchSlots} serviceIds={serviceIds} packageId={packageId} staffId={staffId} defaultDate={defaultDate} minDate={today} />
          <SubmitButton pending={r.pending} size="sm">
            Değişikliği gönder
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
