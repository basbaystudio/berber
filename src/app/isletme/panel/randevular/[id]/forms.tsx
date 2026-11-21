"use client";

import { useState } from "react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { SlotPicker } from "@/components/panel/slot-picker";
import type { SlotResult } from "../actions";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

export function CancelForm({ action, label }: { action: Action; label: string }) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit } = useFormAction(action);
  if (!open)
    return (
      <Button variant="dangerOutline" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  return (
    <form onSubmit={onSubmit} className="w-full space-y-2">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Input name="note" maxLength={300} placeholder="Müşteriye iletilecek not (isteğe bağlı)" aria-label="İptal notu" />
      <div className="flex gap-2">
        <SubmitButton pending={pending} variant="danger" size="sm">
          {label}
        </SubmitButton>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

export function RescheduleForm({
  action,
  fetchSlots,
  serviceIds,
  packageId,
  staff,
  currentStaffId,
  today,
  defaultDate,
  appointmentId,
}: {
  action: Action;
  fetchSlots: (i: { date: string; serviceIds: string[]; packageId?: string; staffId?: string | null; ignoreAppointmentId?: string }) => Promise<SlotResult>;
  serviceIds: string[];
  packageId?: string;
  staff: { id: string; name: string }[];
  currentStaffId: string;
  today: string;
  defaultDate: string;
  appointmentId: string;
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  const [staffId, setStaffId] = useState(currentStaffId);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <Select name="staffId" value={staffId} onChange={(e) => setStaffId(e.target.value)} aria-label="Çalışan" className="max-w-xs">
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <SlotPicker fetchSlots={fetchSlots} serviceIds={serviceIds} packageId={packageId} staffId={staffId} defaultDate={defaultDate} minDate={today} ignoreAppointmentId={appointmentId} />
      {fe?.time && <p className="text-sm text-red-600">{fe.time}</p>}
      <SubmitButton pending={pending}>Yeni zamanı kaydet</SubmitButton>
    </form>
  );
}

export function NoteForm({ action, defaultValue }: { action: Action; defaultValue: string }) {
  const { state, pending, onSubmit } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea name="notes" rows={3} maxLength={2000} defaultValue={defaultValue} aria-label="Not" placeholder="Yalnızca işletme görür" />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} size="sm" variant="outline">
          Notu kaydet
        </SubmitButton>
        {state.status === "success" && <span className="text-xs text-emerald-700">{state.message}</span>}
        {state.status === "error" && <span className="text-xs text-red-600">{state.message}</span>}
      </div>
    </form>
  );
}
