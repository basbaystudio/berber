"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { bookingSettingsSchema, updateBookingSettings } from "@/server/modules/business/settings";
import { bizActor } from "../_actor";

export async function saveBookingSettingsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await updateBookingSettings(db, biz, parseInput(bookingSettingsSchema, formToObject(fd)));
    revalidatePath("/isletme/panel/ayarlar");
    return { status: "success", message: "Randevu ayarları kaydedildi." };
  });
}
