"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { runAction, type ActionState } from "@/server/lib/action";
import { readDocumentUpload, uploadDocument } from "@/server/modules/business/documents";
import { bizActor } from "../_actor";

export async function uploadDocumentAction(typeId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor({ upload: true });
    await uploadDocument(db, biz, z.string().uuid().parse(typeId), await readDocumentUpload(fd.get("file")));
    revalidatePath("/isletme/panel", "layout");
    return { status: "success", message: "Belge yüklendi, incelemeye gönderildi." };
  });
}
