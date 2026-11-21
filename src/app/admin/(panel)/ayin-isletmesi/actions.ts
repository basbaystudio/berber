"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { awardMonth } from "@/server/modules/reviews/reviews";

export async function awardAction(month: string, businessId: string): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    await awardMonth(db, { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip }, z.string().regex(/^\d{4}-\d{2}$/).parse(month), z.string().uuid().parse(businessId));
    revalidatePath("/admin/ayin-isletmesi");
    revalidatePath("/", "layout");
    return { status: "success", message: "Ödül verildi; işletmeye bildirildi." };
  });
}
