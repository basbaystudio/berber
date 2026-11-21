"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { documentTypeSchema, reviewDocument, reviewSchema, saveDocumentType } from "@/server/modules/admin/documents";

async function actor() {
  const ctx = await requireAdmin();
  return { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip };
}

export async function reviewDocumentAction(docId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    const input = parseInput(reviewSchema, formToObject(fd));
    await reviewDocument(db, a, z.string().uuid().parse(docId), input);
    revalidatePath("/admin", "layout");
    return { status: "success", message: input.decision === "APPROVED" ? "Belge onaylandı." : "Belge reddedildi; işletmeye bildirildi." };
  });
}

export async function saveDocumentTypeAction(typeId: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    await saveDocumentType(db, a, typeId ? z.string().uuid().parse(typeId) : null, parseInput(documentTypeSchema, formToObject(fd)));
    revalidatePath("/admin/belgeler");
    return { status: "success", message: typeId ? "Kaydedildi." : "Belge türü eklendi." };
  });
}
