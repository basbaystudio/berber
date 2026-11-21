"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import {
  addTimeOff,
  createStaff,
  deleteStaff,
  deleteTimeOff,
  setStaffPhoto,
  setStaffServices,
  setStaffWeekly,
  staffSchema,
  timeOffSchema,
  updateStaff,
} from "@/server/modules/business/staff";
import { readUpload } from "@/server/storage/images";
import { weeklyRangesSchema } from "@/lib/schedule";
import { bizActor } from "../_actor";

const id = z.string().uuid();
const ok = (message: string): ActionState => {
  revalidatePath("/isletme/panel", "layout");
  return { status: "success", message };
};

export async function createStaffAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const s = await createStaff(db, biz, parseInput(staffSchema, { ...formToObject(fd), isActive: "on" }));
    revalidatePath("/isletme/panel", "layout");
    redirect(`/isletme/panel/calisanlar/${s.id}?yeni=1`);
  });
}

export async function updateStaffAction(staffId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await updateStaff(db, biz, id.parse(staffId), parseInput(staffSchema, formToObject(fd)));
    return ok("Çalışan bilgileri kaydedildi.");
  });
}

export async function staffPhotoAction(staffId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor({ upload: true });
    await setStaffPhoto(db, biz, id.parse(staffId), await readUpload(fd.get("file")));
    return ok("Fotoğraf güncellendi.");
  });
}

export async function staffServicesAction(staffId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const ids = z.array(z.string().uuid()).max(200).parse(fd.getAll("serviceIds"));
    await setStaffServices(db, biz, id.parse(staffId), ids);
    return ok("Hizmetler kaydedildi.");
  });
}

export async function staffWeeklyAction(staffId: string, kind: "shifts" | "breaks", _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const r = weeklyRangesSchema.safeParse(fd.get("weekly"));
    if (!r.success) throw new AppError("VALIDATION", r.error.issues[0]?.message ?? "Program geçersiz.");
    await setStaffWeekly(db, biz, id.parse(staffId), z.enum(["shifts", "breaks"]).parse(kind), r.data);
    return ok(kind === "shifts" ? "Vardiya kaydedildi." : "Molalar kaydedildi.");
  });
}

export async function addTimeOffAction(staffId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await addTimeOff(db, biz, id.parse(staffId), parseInput(timeOffSchema, formToObject(fd)));
    return ok("İzin eklendi.");
  });
}

export async function deleteTimeOffAction(timeOffId: string): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await deleteTimeOff(db, biz, id.parse(timeOffId));
    return ok("İzin kaldırıldı.");
  });
}

export async function deleteStaffAction(staffId: string): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await deleteStaff(db, biz, id.parse(staffId));
    revalidatePath("/isletme/panel", "layout");
    redirect("/isletme/panel/calisanlar");
  });
}
