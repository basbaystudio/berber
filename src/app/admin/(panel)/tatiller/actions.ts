"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { deleteHoliday, holidaySchema, upsertHoliday } from "@/server/modules/admin/holidays";

export async function upsertHolidayAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    await upsertHoliday(db, { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip }, parseInput(holidaySchema, formToObject(fd)));
    revalidatePath("/admin/tatiller");
    return { status: "success", message: "Tatil kaydedildi." };
  });
}

export async function deleteHolidayAction(date: string): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    await deleteHoliday(db, { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip }, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(date));
    revalidatePath("/admin/tatiller");
    return { status: "success", message: "Silindi." };
  });
}
