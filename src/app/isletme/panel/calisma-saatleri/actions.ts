"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import {
  addExceptions,
  clearTempClosure,
  deleteException,
  exceptionSchema,
  setTempClosure,
  setWeeklyHours,
  tempClosureSchema,
} from "@/server/modules/business/hours";
import { weeklyRangesSchema } from "@/lib/schedule";
import { bizActor } from "../_actor";

const done = (message: string): ActionState => {
  revalidatePath("/isletme/panel", "layout");
  return { status: "success", message };
};

export async function saveHoursAction(_p: ActionState, fd: FormData) {
  return runAction(async () => {
    const biz = await bizActor();
    const r = weeklyRangesSchema.safeParse(fd.get("weekly"));
    if (!r.success) throw new AppError("VALIDATION", r.error.issues[0]?.message ?? "Program geçersiz.");
    await setWeeklyHours(db, biz, r.data);
    return done("Çalışma saatleri kaydedildi.");
  });
}

export async function addExceptionAction(_p: ActionState, fd: FormData) {
  return runAction(async () => {
    const biz = await bizActor();
    await addExceptions(db, biz, parseInput(exceptionSchema, formToObject(fd)));
    return done("Özel gün kaydedildi.");
  });
}

export async function closeHolidayAction(date: string, name: string) {
  return runAction(async () => {
    const biz = await bizActor();
    await addExceptions(db, biz, { startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(date), kind: "CLOSED", reason: "HOLIDAY", note: name.slice(0, 120), ranges: [] });
    return done(`${name} kapalı olarak işaretlendi.`);
  });
}

export async function deleteExceptionAction(id: string) {
  return runAction(async () => {
    const biz = await bizActor();
    await deleteException(db, biz, z.string().uuid().parse(id));
    return done("Kaldırıldı.");
  });
}

export async function tempCloseAction(_p: ActionState, fd: FormData) {
  return runAction(async () => {
    const biz = await bizActor();
    await setTempClosure(db, biz, parseInput(tempClosureSchema, formToObject(fd)));
    return done("İşletme geçici olarak kapatıldı.");
  });
}

export async function reopenAction() {
  return runAction(async () => {
    const biz = await bizActor();
    await clearTempClosure(db, biz);
    return done("Geçici kapanış kaldırıldı.");
  });
}
