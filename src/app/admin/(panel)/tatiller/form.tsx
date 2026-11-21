"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

export function HolidayForm({ action }: { action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <Field label="Tarih" name="date" error={fe?.date} required>
          <Input id="date" name="date" type="date" />
        </Field>
        <Field label="Tatil adı" name="name" error={fe?.name} required>
          <Input id="name" name="name" maxLength={80} placeholder="Ramazan Bayramı 1. Gün" />
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <Checkbox name="isHalfDay" label="Yarım gün (arife)" />
        <SubmitButton pending={pending}>Ekle</SubmitButton>
      </div>
    </form>
  );
}
