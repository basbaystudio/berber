"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { acceptContract } from "@/server/modules/business/contracts";
import { bizActor } from "../_actor";

export async function acceptContractAction(versionId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    if (fd.get("confirm") !== "on") throw new AppError("VALIDATION", "Onaylamak için sözleşmeyi okuduğunuzu işaretleyin.");
    await acceptContract(db, biz, z.string().uuid().parse(versionId), await getRequestMeta());
    revalidatePath("/isletme/panel", "layout");
    return { status: "success", message: "Sözleşme onaylandı." };
  });
}
