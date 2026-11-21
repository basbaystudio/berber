"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { createServiceType, serviceTypeSchema, updateServiceType } from "@/server/modules/admin/service-types";

export async function createServiceTypeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const input = parseInput(serviceTypeSchema, formToObject(fd));
    await createServiceType(db, { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip }, input);
    revalidatePath("/admin/hizmet-turleri");
    return { status: "success", message: `“${input.name}” eklendi.` };
  });
}

export async function updateServiceTypeAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const input = parseInput(serviceTypeSchema, formToObject(fd));
    await updateServiceType(db, { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip }, z.string().uuid().parse(id), input);
    revalidatePath("/admin/hizmet-turleri");
    return { status: "success", message: "Kaydedildi." };
  });
}
