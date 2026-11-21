"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireBusiness } from "@/server/auth/guards";
import { AppError } from "@/server/lib/errors";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { dateSchema, getAvailableSlots, selectionSchema } from "@/server/modules/booking/availability";
import {
  cancelByBusiness,
  confirmAppointment,
  createAppointment,
  finalizeAppointment,
  guestSchema,
  rescheduleAppointment,
  setInternalNote,
} from "@/server/modules/booking/service";
import { searchCustomers } from "@/server/modules/business/customers";
import { minuteToDate } from "@/lib/availability";
import { toMinutes } from "@/lib/schedule";
import { emptyToUndefined, optionalText } from "@/lib/validation/common";
import { bizActor } from "../_actor";

const id = z.string().uuid();
const refresh = () => revalidatePath("/isletme/panel", "layout");
const actorOf = (b: { userId: string; ip?: string | null }) => ({ realm: "BUSINESS" as const, id: b.userId, ip: b.ip });

export type SlotResult = { slots: { time: string; staffIds: string[] }[]; durationMin: number; totalKurus: number } | { error: string };

/** Panel için müsait saatler (işletme kendi verisi). */
export async function getSlotsAction(input: { date: string; serviceIds: string[]; packageId?: string; staffId?: string | null; ignoreAppointmentId?: string }): Promise<SlotResult> {
  try {
    const ctx = await requireBusiness();
    const date = dateSchema.parse(input.date);
    const selection = selectionSchema.parse({ serviceIds: input.serviceIds ?? [], packageId: input.packageId || undefined });
    const r = await getAvailableSlots(db, ctx.businessId, {
      date,
      selection,
      staffId: input.staffId ? id.parse(input.staffId) : null,
      mode: "PANEL",
      ignoreAppointmentId: input.ignoreAppointmentId ? id.parse(input.ignoreAppointmentId) : undefined,
    });
    return { slots: r.slots.map((s) => ({ time: s.time, staffIds: s.staffIds })), durationMin: r.durationMin, totalKurus: r.totalKurus };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Geçersiz seçim." };
    throw e;
  }
}

export async function searchCustomersAction(q: string) {
  const ctx = await requireBusiness();
  const query = String(q ?? "").trim().slice(0, 60);
  if (query.length < 2) return [];
  return searchCustomers(db, ctx.businessId, query);
}

const createSchema = z
  .object({
    date: dateSchema,
    time: z.string().regex(/^\d{2}:\d{2}$/, "Saat seçin."),
    staffId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    packageId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    serviceIds: z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().uuid()).max(10)),
    businessCustomerId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    guestName: z.preprocess(emptyToUndefined, z.string().optional()),
    guestPhone: z.preprocess(emptyToUndefined, z.string().optional()),
    internalNote: optionalText(500, "Not"),
  })
  .refine((v) => v.businessCustomerId || v.guestName, { message: "Müşteri seçin ya da adını yazın.", path: ["guestName"] });

export async function createPanelAppointmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const v = parseInput(createSchema, formToObject(fd));
    const customer = v.businessCustomerId ? { businessCustomerId: v.businessCustomerId } : { guest: parseInput(guestSchema, { name: v.guestName, phone: v.guestPhone }) };
    const a = await createAppointment(db, {
      businessId: biz.businessId,
      mode: "PANEL",
      actor: actorOf(biz),
      customer,
      selection: parseInput(selectionSchema, { serviceIds: v.serviceIds, packageId: v.packageId }),
      staffId: v.staffId ?? null,
      startsAt: minuteToDate(v.date, toMinutes(v.time)),
      internalNote: v.internalNote ?? null,
    });
    refresh();
    redirect(`/isletme/panel/randevular/${a.id}?yeni=1`);
  });
}

export async function confirmAction(apptId: string): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await confirmAppointment(db, biz.businessId, id.parse(apptId), actorOf(biz));
    refresh();
    return { status: "success", message: "Randevu onaylandı; müşteriye bildirildi." };
  });
}

export async function cancelAction(apptId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const note = parseInput(z.object({ note: optionalText(300, "Not") }), formToObject(fd)).note;
    await cancelByBusiness(db, biz.businessId, id.parse(apptId), actorOf(biz), note ?? null);
    refresh();
    return { status: "success", message: "Randevu iptal edildi; saat yeniden müsait." };
  });
}

export async function finalizeAction(apptId: string, to: "COMPLETED" | "NO_SHOW"): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await finalizeAppointment(db, biz.businessId, id.parse(apptId), z.enum(["COMPLETED", "NO_SHOW"]).parse(to), actorOf(biz));
    refresh();
    return { status: "success", message: to === "COMPLETED" ? "Tamamlandı olarak işaretlendi." : "Gelmedi olarak işaretlendi." };
  });
}

export async function rescheduleAction(apptId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const v = parseInput(
      z.object({ date: dateSchema, time: z.string().regex(/^\d{2}:\d{2}$/, "Saat seçin."), staffId: z.preprocess(emptyToUndefined, z.string().uuid().optional()) }),
      formToObject(fd),
    );
    await rescheduleAppointment(db, { businessId: biz.businessId }, id.parse(apptId), { startsAt: minuteToDate(v.date, toMinutes(v.time)), staffId: v.staffId ?? null }, actorOf(biz));
    refresh();
    return { status: "success", message: "Randevu güncellendi." };
  });
}

export async function internalNoteAction(apptId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const note = parseInput(z.object({ notes: optionalText(1000, "Not") }), formToObject(fd)).notes;
    await setInternalNote(db, biz.businessId, id.parse(apptId), note ?? null);
    refresh();
    return { status: "success", message: "Not kaydedildi." };
  });
}
