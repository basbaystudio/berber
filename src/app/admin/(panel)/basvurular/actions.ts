"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { enforce, RATE_LIMITS } from "@/server/auth/rate-limit";
import { runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { approveApplication, rejectApplication } from "@/server/modules/applications";

async function actor() {
  const ctx = await requireAdmin();
  await enforce(db, `admin:write:${ctx.admin.id}`, RATE_LIMITS.adminWrite);
  return { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip };
}

export type ApprovedInfo = { businessId: string; login: string; tempPassword: string; trialMonths: number; isEarlyAdopter: boolean };

/** Onay: sayfayı hemen yenilemez ki geçici şifre ekranda gösterilebilsin. */
export async function approveApplicationAction(id: string): Promise<ActionState<ApprovedInfo>> {
  return runAction(async () => {
    const r = await approveApplication(db, await actor(), z.string().uuid().parse(id));
    return { status: "success", data: { businessId: r.businessId, login: r.login, tempPassword: r.tempPassword, trialMonths: r.trialMonths, isEarlyAdopter: r.isEarlyAdopter } };
  });
}

export async function rejectApplicationAction(id: string, reason: string): Promise<ActionState> {
  return runAction(async () => {
    await rejectApplication(db, await actor(), z.string().uuid().parse(id), z.string().trim().max(300).parse(reason) || undefined);
    revalidatePath("/admin/basvurular");
    revalidatePath("/admin", "layout");
    return { status: "success", message: "Başvuru reddedildi." };
  });
}
