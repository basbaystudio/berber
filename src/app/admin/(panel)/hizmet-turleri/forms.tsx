"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Input, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

export function ServiceTypeRowForm({
  action,
  defaults,
}: {
  action: Action;
  defaults?: { name: string; sortOrder: number; isActive: boolean };
}) {
  const isNew = !defaults;
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action, { resetOnSuccess: isNew });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1 basis-48">
          <span className="sr-only">Ad</span>
          <Input name="name" defaultValue={defaults?.name} placeholder={isNew ? "Yeni hizmet türü adı" : undefined} maxLength={60} aria-invalid={!!fe?.name} />
        </label>
        <label className="w-24">
          <span className="sr-only">Sıra</span>
          <Input name="sortOrder" type="number" min={0} max={999} defaultValue={defaults?.sortOrder ?? 0} title="Sıra" />
        </label>
        <Checkbox name="isActive" defaultChecked={defaults?.isActive ?? true} label="Aktif" />
        <SubmitButton pending={pending} variant={isNew ? "primary" : "outline"} size="md" pendingText="…">
          {isNew ? "Ekle" : "Kaydet"}
        </SubmitButton>
      </div>
      {state.status === "error" && <Alert tone="error">{fe?.name ?? state.message}</Alert>}
      {state.status === "success" && isNew && <Alert tone="success">{state.message}</Alert>}
      {state.status === "success" && !isNew && <p className="text-xs text-emerald-700">{state.message}</p>}
    </form>
  );
}
