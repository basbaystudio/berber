"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Button, type ButtonVariant } from "./button";
import { Alert } from "./feedback";
import { useButtonAction } from "./use-action";

/**
 * Tek tıklamalı işlem butonu (onaylı). Sonucu butonun altında gösterir.
 * `render` verilirse başarılı sonucun verisi özel olarak gösterilebilir.
 */
export function ActionButton<T>({
  action,
  children,
  variant = "outline",
  confirm,
  pendingText = "İşleniyor…",
  render,
  disabled,
}: {
  action: () => Promise<ActionState<T>>;
  children: ReactNode;
  variant?: ButtonVariant;
  confirm?: string;
  pendingText?: string;
  render?: (data: T) => ReactNode;
  disabled?: boolean;
}) {
  const { state, pending, run } = useButtonAction(action);
  return (
    <div className="space-y-2">
      <Button
        variant={variant}
        disabled={pending || disabled}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          run();
        }}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? pendingText : children}
      </Button>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (render && state.data !== undefined ? render(state.data) : state.message && <Alert tone="success">{state.message}</Alert>)}
    </div>
  );
}
