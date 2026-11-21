"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { audit } from "@/server/lib/audit";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { setSetting } from "@/server/modules/platform/settings";
import { emptyToUndefined } from "@/lib/validation/common";

const optEmail = z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().email("Geçerli bir e-posta girin.").max(254).optional());
const contactSchema = z.object({
  email: optEmail,
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(30, "En fazla 30 karakter.").optional()),
  alertEmail: optEmail,
});

export async function saveContactAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const input = parseInput(contactSchema, formToObject(fd));
    await setSetting(db, "platform.contact", { email: input.email ?? "", phone: input.phone ?? "", alertEmail: input.alertEmail ?? "" }, ctx.admin.id);
    await audit(db, { actorRealm: "ADMIN", actorId: ctx.admin.id, action: "settings.contact_update", ip: (await getRequestMeta()).ip });
    revalidatePath("/admin/ayarlar");
    return { status: "success", message: "Kaydedildi." };
  });
}
