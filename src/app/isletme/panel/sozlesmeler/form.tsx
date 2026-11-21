"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

export function AcceptForm({ action, title }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; title: string }) {
  const { state, pending, onSubmit } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <Checkbox name="confirm" label={`“${title}” metnini okudum, kabul ediyorum.`} />
      <SubmitButton pending={pending}>Onayla</SubmitButton>
    </form>
  );
}
