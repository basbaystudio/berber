"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { runAction, type ActionState } from "@/server/lib/action";
import { markRead } from "@/server/modules/business/inbox";
import { bizActor } from "../_actor";

export async function markAllReadAction(): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await markRead(db, biz.businessId);
    revalidatePath("/isletme/panel", "layout");
    return { status: "success", message: "Tüm bildirimler okundu olarak işaretlendi." };
  });
}
