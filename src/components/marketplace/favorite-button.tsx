"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import type { ActionState } from "@/server/lib/action";
import { cn } from "@/lib/cn";

export function FavoriteButton({ initial, action, loginHref }: { initial: boolean; action: () => Promise<ActionState<{ favorite: boolean; loginRequired?: boolean }>>; loginHref: string }) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={fav}
      onClick={() =>
        start(async () => {
          const r = await action();
          if (r.status === "success" && r.data?.loginRequired) return router.push(loginHref);
          if (r.status === "success" && r.data) setFav(r.data.favorite);
        })
      }
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-700 hover:border-stone-300"
    >
      <Heart className={cn("size-4", fav ? "fill-red-500 text-red-500" : "text-stone-500")} aria-hidden />
      {fav ? "Favorilerde" : "Favorilere ekle"}
    </button>
  );
}
