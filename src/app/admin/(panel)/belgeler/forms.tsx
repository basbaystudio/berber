"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { useRef } from "react";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

/** Onay / ret (ret için gerekçe zorunlu). */
export function ReviewForm({ action }: { action: Action }) {
  const { state, pending, onSubmit } = useFormAction(action);
  const decision = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submit = (d: "APPROVED" | "REJECTED") => {
    if (decision.current) decision.current.value = d;
    formRef.current?.requestSubmit();
  };
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <input ref={decision} type="hidden" name="decision" defaultValue="APPROVED" />
      <Input name="note" placeholder="Ret nedeni (reddederken zorunlu)" maxLength={500} aria-label="Ret nedeni" />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => submit("APPROVED")}>
          Onayla
        </Button>
        <Button size="sm" variant="dangerOutline" disabled={pending} onClick={() => submit("REJECTED")}>
          Reddet
        </Button>
      </div>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <p className="text-xs text-emerald-700">{state.message}</p>}
    </form>
  );
}

export function DocumentTypeForm({
  action,
  defaults,
}: {
  action: Action;
  defaults?: { name: string; description: string | null; isRequired: boolean; isActive: boolean; sortOrder: number };
}) {
  const isNew = !defaults;
  const { state, pending, onSubmit, fieldErrors: fe, version } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2" key={isNew ? version : "e"}>
      <div className="flex flex-wrap items-center gap-2">
        <Input name="name" defaultValue={defaults?.name} placeholder="Belge adı (örn. Esnaf sicil kaydı)" maxLength={80} className="min-w-0 flex-1 basis-56" aria-label="Belge adı" aria-invalid={!!fe?.name} />
        <Input name="description" defaultValue={defaults?.description ?? ""} placeholder="Açıklama" maxLength={200} className="min-w-0 flex-1 basis-56" aria-label="Açıklama" />
        <Input name="sortOrder" type="number" min={0} max={999} defaultValue={defaults?.sortOrder ?? 0} className="w-20" aria-label="Sıra" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox name="isRequired" defaultChecked={defaults?.isRequired ?? true} label="Zorunlu (yayın için gerekli)" />
        <Checkbox name="isActive" defaultChecked={defaults?.isActive ?? true} label="Aktif" />
        <Button type="submit" size="sm" variant={isNew ? "primary" : "outline"} disabled={pending}>
          {isNew ? "Ekle" : "Kaydet"}
        </Button>
        {state.status === "error" && <span className="text-sm text-red-600">{fe?.name ?? state.message}</span>}
        {state.status === "success" && <span className="text-sm text-emerald-700">{state.message}</span>}
      </div>
    </form>
  );
}
