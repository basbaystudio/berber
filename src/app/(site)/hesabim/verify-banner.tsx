"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { useButtonAction } from "@/components/ui/use-action";

export function VerifyBanner({ action }: { action: () => Promise<ActionState> }) {
  const { state, pending, run } = useButtonAction(action);
  return (
    <Alert tone="warning" className="mb-6" title="E-posta adresinizi doğrulayın">
      Randevu alabilmek için size gönderdiğimiz bağlantıya tıklayın.{" "}
      <button type="button" disabled={pending} onClick={run} className="font-medium underline underline-offset-4">
        Yeniden gönder
      </button>
      {state.status === "success" && <span className="ml-2 text-emerald-700">{state.message}</span>}
      {state.status === "error" && <span className="ml-2 text-red-700">{state.message}</span>}
    </Alert>
  );
}
