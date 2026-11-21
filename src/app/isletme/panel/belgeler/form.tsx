"use client";

import type { ActionState } from "@/server/lib/action";
import { SubmitButton } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";

export function DocumentUploadForm({ action, label }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; label: string }) {
  const { state, pending, onSubmit, version } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-2" key={version}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          accept="application/pdf,image/jpeg,image/png"
          aria-label={`${label} dosyası`}
          className="max-w-64 text-sm text-stone-600 file:mr-3 file:rounded-xl file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:text-stone-700"
        />
        <SubmitButton pending={pending} size="sm" pendingText="Yükleniyor…">
          Yükle
        </SubmitButton>
      </div>
      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-emerald-700">{state.message}</p>}
    </form>
  );
}
