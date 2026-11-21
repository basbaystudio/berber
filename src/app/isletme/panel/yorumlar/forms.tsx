"use client";

import { useState } from "react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

type Action = (p: ActionState, fd: FormData) => Promise<ActionState>;

export function ReplyForm({ action, defaultValue }: { action: Action; defaultValue: string }) {
  const { state, pending, onSubmit } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea name="reply" rows={2} maxLength={1000} defaultValue={defaultValue} placeholder="Herkese açık yanıtınız" aria-label="Yanıt" />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} size="sm" variant="outline">
          {defaultValue ? "Yanıtı güncelle" : "Yanıtla"}
        </SubmitButton>
        {state.status === "success" && <span className="text-xs text-emerald-700">{state.message}</span>}
        {state.status === "error" && <span className="text-xs text-red-600">{state.message}</span>}
      </div>
    </form>
  );
}

export function ReportForm({ action }: { action: Action }) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit } = useFormAction(action);
  if (state.status === "success") return <p className="text-xs text-emerald-700">{state.message}</p>;
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Şikâyet et
      </Button>
    );
  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-2xl bg-stone-50 p-3">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Select name="reason" defaultValue="" aria-label="Şikâyet nedeni">
        <option value="" disabled>
          Neden seçin
        </option>
        <option value="SPAM">Spam / reklam</option>
        <option value="INSULT">Hakaret / küfür</option>
        <option value="MISLEADING">Yanıltıcı / gerçek dışı</option>
        <option value="OTHER">Diğer</option>
      </Select>
      <Input name="note" maxLength={500} placeholder="Açıklama (isteğe bağlı)" aria-label="Şikâyet açıklaması" />
      <div className="flex gap-2">
        <SubmitButton pending={pending} size="sm">
          Gönder
        </SubmitButton>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
