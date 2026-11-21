"use client";

import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { useFormAction } from "@/components/ui/use-action";

/** Tek görsel yükleme formu (logo, kapak vb.). */
export function ImageUploadForm({
  action,
  currentUrl,
  aspect,
  label,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  currentUrl: string | null;
  aspect: string;
  label: string;
}) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      <ImageInput currentUrl={currentUrl} aspect={aspect} label={label} error={fe?.file} maxSide={2000} />
      <SubmitButton pending={pending} variant="outline" pendingText="Yükleniyor…">
        Yükle
      </SubmitButton>
    </form>
  );
}
