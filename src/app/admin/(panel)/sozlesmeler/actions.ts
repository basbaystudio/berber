"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { createContract, newContractSchema, publishVersion, versionSchema } from "@/server/modules/admin/contracts";

async function actor() {
  const ctx = await requireAdmin();
  return { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip };
}

export async function createContractAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    const c = await createContract(db, a, parseInput(newContractSchema, formToObject(fd)));
    redirect(`/admin/sozlesmeler/${c.id}`);
  });
}

export async function publishVersionAction(contractId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    const v = await publishVersion(db, a, z.string().uuid().parse(contractId), parseInput(versionSchema, formToObject(fd)));
    revalidatePath("/admin/sozlesmeler", "layout");
    return { status: "success", message: `Sürüm ${v.version} yayınlandı. İşletmelere bildirim gönderildi.` };
  });
}
