"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { customerNotesSchema, updateCustomerNotes } from "@/server/modules/business/customers";
import { bizActor } from "../../_actor";

export async function customerNotesAction(customerId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const { notes } = parseInput(customerNotesSchema, formToObject(fd));
    await updateCustomerNotes(db, biz, z.string().uuid().parse(customerId), notes ?? null);
    revalidatePath(`/isletme/panel/musteriler/${customerId}`);
    return { status: "success", message: "Not kaydedildi." };
  });
}
