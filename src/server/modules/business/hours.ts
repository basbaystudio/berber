import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businessExceptionRanges, businessExceptions, businessHours, businessSettings, publicHolidays } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { optionalText } from "@/lib/validation/common";
import { addDaysStr, parseLocalDateTime, todayTR } from "@/lib/dates";
import {
  computeOpenState,
  datesBetween,
  dayRangesSchema,
  shortTime,
  type DayException,
  type OpenStateInput,
  type WeeklyRanges,
} from "@/lib/schedule";
import { bizAudit, type Biz } from "./context";

/* ───────── Haftalık çalışma saatleri ───────── */

export async function getWeeklyHours(db: Executor, businessId: string): Promise<WeeklyRanges> {
  const rows = await db.select().from(businessHours).where(eq(businessHours.businessId, businessId)).orderBy(asc(businessHours.weekday), asc(businessHours.startTime));
  const out: WeeklyRanges = {};
  for (const r of rows) (out[r.weekday] ??= []).push({ start: shortTime(r.startTime), end: shortTime(r.endTime) });
  return out;
}

/** Haftalık programı bütünüyle değiştirir (gün başına birden çok aralık). */
export async function setWeeklyHours(db: DB, biz: Biz, weekly: WeeklyRanges) {
  await db.transaction(async (tx) => {
    await tx.delete(businessHours).where(eq(businessHours.businessId, biz.businessId));
    const rows = Object.entries(weekly).flatMap(([wd, ranges]) =>
      ranges.map((r) => ({ businessId: biz.businessId, weekday: Number(wd), startTime: r.start, endTime: r.end })),
    );
    if (rows.length) await tx.insert(businessHours).values(rows);
    await audit(tx, { ...bizAudit(biz), action: "business.hours_update", meta: { ranges: rows.length } });
  });
}

/* ───────── Tarih istisnaları (tatil, özel gün, izin) ───────── */

export const exceptionSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Başlangıç tarihi seçin."),
    endDate: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    kind: z.enum(["CLOSED", "CUSTOM_HOURS"], { error: "Tür seçin." }),
    reason: z.enum(["HOLIDAY", "SPECIAL", "VACATION", "OTHER"]).default("OTHER"),
    note: optionalText(120, "Not"),
    ranges: z.preprocess((v) => {
      if (typeof v !== "string" || !v) return [];
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }, dayRangesSchema),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { message: "Bitiş tarihi başlangıçtan önce olamaz.", path: ["endDate"] })
  .refine((v) => v.kind === "CLOSED" || v.ranges.length > 0, { message: "Özel çalışma saati için en az bir aralık girin.", path: ["ranges"] });

export type ExceptionInput = z.infer<typeof exceptionSchema>;

/** Tarih (aralığı) için istisna ekler; aynı güne ait eski istisna değiştirilir. En fazla 62 gün. */
export async function addExceptions(db: DB, biz: Biz, input: ExceptionInput) {
  const today = todayTR();
  if (input.startDate < today) throw new AppError("VALIDATION", "Geçmiş tarihler için düzenleme yapılamaz.", { startDate: "Geçmiş tarih seçilemez." });
  const days = datesBetween(input.startDate, input.endDate ?? input.startDate);
  if (input.endDate && days.at(-1) !== input.endDate)
    throw new AppError("VALIDATION", "Tek seferde en fazla 62 gün seçilebilir.", { endDate: "En fazla 62 gün." });
  await db.transaction(async (tx) => {
    await tx.delete(businessExceptions).where(and(eq(businessExceptions.businessId, biz.businessId), inArray(businessExceptions.date, days)));
    for (const date of days) {
      const [ex] = await tx
        .insert(businessExceptions)
        .values({ businessId: biz.businessId, date, kind: input.kind, reason: input.reason, note: input.note ?? null })
        .returning({ id: businessExceptions.id });
      if (input.kind === "CUSTOM_HOURS")
        await tx.insert(businessExceptionRanges).values(input.ranges.map((r) => ({ exceptionId: ex!.id, startTime: r.start, endTime: r.end })));
    }
    await audit(tx, { ...bizAudit(biz), action: "business.exception_add", meta: { from: input.startDate, days: days.length, kind: input.kind } });
  });
}

export async function deleteException(db: DB, biz: Biz, id: string) {
  const res = await db
    .delete(businessExceptions)
    .where(and(eq(businessExceptions.id, id), eq(businessExceptions.businessId, biz.businessId)))
    .returning({ id: businessExceptions.id });
  if (!res.length) throw notFound("Kayıt");
}

/** [from, to] aralığındaki istisnalar (tarih → istisna). */
export async function getExceptionMap(db: Executor, businessId: string, from: string, to: string): Promise<Record<string, DayException & { id: string; reason: string }>> {
  const rows = await db
    .select({ ex: businessExceptions, start: businessExceptionRanges.startTime, end: businessExceptionRanges.endTime })
    .from(businessExceptions)
    .leftJoin(businessExceptionRanges, eq(businessExceptionRanges.exceptionId, businessExceptions.id))
    .where(and(eq(businessExceptions.businessId, businessId), gte(businessExceptions.date, from), lte(businessExceptions.date, to)))
    .orderBy(asc(businessExceptions.date), asc(businessExceptionRanges.startTime));
  const out: Record<string, DayException & { id: string; reason: string }> = {};
  for (const r of rows) {
    const e = (out[r.ex.date] ??= { id: r.ex.id, kind: r.ex.kind, ranges: [], note: r.ex.note, reason: r.ex.reason });
    if (r.start && r.end) e.ranges.push({ start: shortTime(r.start), end: shortTime(r.end) });
  }
  return out;
}

/** Yaklaşan resmî tatiller (admin listesi) — işletme tek tıkla kapalı işaretleyebilir. */
export function upcomingHolidays(db: Executor, days = 120) {
  const today = todayTR();
  return db
    .select()
    .from(publicHolidays)
    .where(and(gte(publicHolidays.date, today), lte(publicHolidays.date, addDaysStr(today, days))))
    .orderBy(asc(publicHolidays.date));
}

/* ───────── Geçici kapanış ───────── */

export const tempClosureSchema = z.object({
  until: z.string().transform((v, ctx) => {
    const d = parseLocalDateTime(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Tarih ve saat seçin." });
      return z.NEVER;
    }
    return d;
  }),
  note: optionalText(120, "Not"),
});

export async function setTempClosure(db: DB, biz: Biz, input: z.infer<typeof tempClosureSchema>) {
  if (input.until <= new Date()) throw new AppError("VALIDATION", "Gelecekte bir tarih seçin.", { until: "Gelecekte bir tarih seçin." });
  await db
    .update(businessSettings)
    .set({ tempClosedUntil: input.until, tempClosedNote: input.note ?? null })
    .where(eq(businessSettings.businessId, biz.businessId));
  await audit(db, { ...bizAudit(biz), action: "business.temp_close", meta: { until: input.until.toISOString() } });
}

export async function clearTempClosure(db: DB, biz: Biz) {
  await db.update(businessSettings).set({ tempClosedUntil: null, tempClosedNote: null }).where(eq(businessSettings.businessId, biz.businessId));
  await audit(db, { ...bizAudit(biz), action: "business.temp_reopen" });
}

/* ───────── Açık / kapalı durumu ───────── */

export async function loadOpenStateInput(db: Executor, businessId: string): Promise<OpenStateInput & { tempClosedNote: string | null }> {
  const today = todayTR();
  const [weekly, exceptions, [settings]] = [
    await getWeeklyHours(db, businessId),
    await getExceptionMap(db, businessId, today, addDaysStr(today, 15)),
    await db.select().from(businessSettings).where(eq(businessSettings.businessId, businessId)),
  ];
  return { weekly, exceptions, tempClosedUntil: settings?.tempClosedUntil ?? null, tempClosedNote: settings?.tempClosedNote ?? null };
}

export async function getBusinessOpenState(db: Executor, businessId: string, now = new Date()) {
  return computeOpenState(await loadOpenStateInput(db, businessId), now);
}
