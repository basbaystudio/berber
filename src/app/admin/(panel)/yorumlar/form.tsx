"use client";

import { useRef } from "react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

export function ResolveForm({ action }: { action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const { state, pending, onSubmit } = useFormAction(action);
  const decision = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const go = (d: "REMOVE" | "REJECT") => {
    if (d === "REMOVE" && !window.confirm("Yorum kaldırılacak ve puan ortalamasından düşülecek. Emin misiniz?")) return;
    if (decision.current) decision.current.value = d;
    form.current?.requestSubmit();
  };
  if (state.status === "success") return <Alert tone="success">{state.message}</Alert>;
  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-2">
      <input ref={decision} type="hidden" name="decision" defaultValue="REJECT" />
      <Input name="adminNote" maxLength={500} placeholder="Not (işletmeye iletilir, isteğe bağlı)" aria-label="Yönetici notu" />
      <div className="flex gap-2">
        <Button size="sm" variant="danger" disabled={pending} onClick={() => go("REMOVE")}>
          Yorumu kaldır
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go("REJECT")}>
          Şikâyeti reddet
        </Button>
      </div>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
    </form>
  );
}
