"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { deleteService, saveService, serviceSchema } from "@/server/modules/business/catalog";
import { bizActor } from "../_actor";

export async function saveServiceAction(serviceId: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await saveService(db, biz, serviceId ? z.string().uuid().parse(serviceId) : null, parseInput(serviceSchema, formToObject(fd)));
    revalidatePath("/isletme/panel", "layout");
    return { status: "success", message: serviceId ? "Hizmet kaydedildi." : "Hizmet eklendi." };
  });
}

export async function deleteServiceAction(serviceId: string): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await deleteService(db, biz, z.string().uuid().parse(serviceId));
    revalidatePath("/isletme/panel", "layout");
    redirect("/isletme/panel/hizmetler");
  });
}
