"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { profileSchema, removeBusinessImage, setBusinessImage, updateProfile } from "@/server/modules/business/profile";
import { readUpload } from "@/server/storage/images";
import { bizActor } from "../_actor";

const kind = z.enum(["logo", "cover"]);

export async function updateProfileAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await updateProfile(db, biz, parseInput(profileSchema, formToObject(fd)));
    revalidatePath("/isletme/panel", "layout");
    return { status: "success", message: "Profil kaydedildi." };
  });
}

export async function uploadBusinessImageAction(k: "logo" | "cover", _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor({ upload: true });
    await setBusinessImage(db, biz, kind.parse(k), await readUpload(fd.get("file")));
    revalidatePath("/isletme/panel/profil");
    return { status: "success", message: k === "logo" ? "Logo güncellendi." : "Kapak görseli güncellendi." };
  });
}

export async function removeBusinessImageAction(k: "logo" | "cover"): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await removeBusinessImage(db, biz, kind.parse(k));
    revalidatePath("/isletme/panel/profil");
    return { status: "success", message: "Kaldırıldı." };
  });
}
