"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { deletePackage, packageSchema, savePackage } from "@/server/modules/business/catalog";
import { bizActor } from "../_actor";

export async function savePackageAction(packageId: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await savePackage(db, biz, packageId ? z.string().uuid().parse(packageId) : null, parseInput(packageSchema, formToObject(fd)));
    revalidatePath("/isletme/panel", "layout");
    return { status: "success", message: packageId ? "Paket kaydedildi." : "Paket eklendi." };
  });
}

export async function deletePackageAction(packageId: string): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await deletePackage(db, biz, z.string().uuid().parse(packageId));
    revalidatePath("/isletme/panel", "layout");
    redirect("/isletme/panel/paketler");
  });
}
