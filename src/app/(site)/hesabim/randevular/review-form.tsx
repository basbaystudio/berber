"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

export function ReviewForm({ action }: { action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const { state, pending, onSubmit, fieldErrors: fe } = useFormAction(action);
  const [rating, setRating] = useState(0);
  if (state.status === "success") return <Alert tone="success">{state.message}</Alert>;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm font-medium text-stone-800">Deneyiminizi değerlendirin</p>
      <input type="hidden" name="rating" value={rating || ""} />
      <div className="flex gap-1" role="radiogroup" aria-label="Puan">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} yıldız`} onClick={() => setRating(n)} className="p-0.5">
            <Star className={cn("size-7", n <= rating ? "fill-accent-500 text-accent-500" : "text-stone-300")} />
          </button>
        ))}
      </div>
      {fe?.rating && <p className="text-sm text-red-600">{fe.rating}</p>}
      <Textarea name="comment" rows={3} maxLength={1000} placeholder="Yorumunuz (isteğe bağlı)" aria-label="Yorum" />
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton pending={pending} size="sm">
        Gönder
      </SubmitButton>
    </form>
  );
}
