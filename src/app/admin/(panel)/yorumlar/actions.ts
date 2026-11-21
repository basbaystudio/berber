"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { resolveReport, resolveSchema } from "@/server/modules/reviews/reviews";

export async function resolveReportAction(reportId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const input = parseInput(resolveSchema, formToObject(fd));
    await resolveReport(db, { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip }, z.string().uuid().parse(reportId), input);
    revalidatePath("/admin/yorumlar");
    return { status: "success", message: input.decision === "REMOVE" ? "Yorum kaldırıldı." : "Şikâyet reddedildi." };
  });
}
