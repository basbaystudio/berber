import "server-only";
import { and, asc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Executor } from "@/server/db/client";
import {
  appointments,
  businessSettings,
  packageItems,
  packageStaff,
  packages,
  services,
  staff,
  staffBreaks,
  staffServices,
  staffShifts,
  staffTimeOff,
} from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { getExceptionMap, getWeeklyHours } from "@/server/modules/business/hours";
import { clipToDay, computeSlots, dayStartUtc, rangesToIntervals, type DayInput, type Interval, type StaffDay } from "@/lib/availability";
import { localMoment, rangesForDay, shortTime } from "@/lib/schedule";
import { addDaysStr, todayTR } from "@/lib/dates";

export type BookingMode = "ONLINE" | "PANEL";

export const selectionSchema = z
  .object({
    serviceIds: z.array(z.string().uuid()).max(10).default([]),
    packageId: z.string().uuid().optional(),
  })
  .refine((s) => (s.packageId ? s.serviceIds.length === 0 : s.serviceIds.length > 0), "Bir paket ya da en az bir hizmet seçin.");
export type Selection = z.infer<typeof selectionSchema>;

export type ResolvedItem = { serviceId: string | null; packageId: string | null; name: string; priceKurus: number; durationMin: number };
export type ResolvedSelection = { items: ResolvedItem[]; durationMin: number; totalKurus: number; staffIds: string[] };

/**
 * Seçimi veritabanından doğrular: süre ve fiyat HER ZAMAN buradan gelir (istemciye güvenilmez).
 * Uygun çalışanlar: aktif, seçilen tüm hizmetlere yetkin (paket için pakete atanmış) çalışanlar.
 */
export async function resolveSelection(db: Executor, businessId: string, sel: Selection): Promise<ResolvedSelection> {
  if (sel.packageId) {
    const [p] = await db
      .select()
      .from(packages)
      .where(and(eq(packages.id, sel.packageId), eq(packages.businessId, businessId), eq(packages.isActive, true), isNull(packages.deletedAt)));
    if (!p) throw new AppError("VALIDATION", "Seçilen paket artık sunulmuyor.");
    const st = await db
      .select({ id: staff.id })
      .from(packageStaff)
      .innerJoin(staff, eq(staff.id, packageStaff.staffId))
      .where(and(eq(packageStaff.packageId, p.id), eq(staff.isActive, true), isNull(staff.deletedAt)));
    return {
      items: [{ serviceId: null, packageId: p.id, name: p.name, priceKurus: p.priceKurus, durationMin: p.durationMin }],
      durationMin: p.durationMin,
      totalKurus: p.priceKurus,
      staffIds: st.map((s) => s.id),
    };
  }
  const ids = [...new Set(sel.serviceIds)];
  const svc = await db
    .select()
    .from(services)
    .where(and(eq(services.businessId, businessId), inArray(services.id, ids), eq(services.isActive, true), isNull(services.deletedAt)));
  if (svc.length !== ids.length) throw new AppError("VALIDATION", "Seçilen hizmetlerden biri artık sunulmuyor.");
  const ordered = ids.map((id) => svc.find((s) => s.id === id)!);
  const links = await db
    .select({ staffId: staffServices.staffId, serviceId: staffServices.serviceId })
    .from(staffServices)
    .innerJoin(staff, eq(staff.id, staffServices.staffId))
    .where(and(eq(staffServices.businessId, businessId), inArray(staffServices.serviceId, ids), eq(staff.isActive, true), isNull(staff.deletedAt)));
  const staffIds = [...new Set(links.map((l) => l.staffId))].filter((sid) => ids.every((id) => links.some((l) => l.staffId === sid && l.serviceId === id)));
  const durationMin = ordered.reduce((a, s) => a + s.durationMin, 0);
  if (durationMin > 600) throw new AppError("VALIDATION", "Seçilen hizmetlerin toplam süresi çok uzun.");
  return {
    items: ordered.map((s) => ({ serviceId: s.id, packageId: null, name: s.name, priceKurus: s.priceKurus, durationMin: s.durationMin })),
    durationMin,
    totalKurus: ordered.reduce((a, s) => a + s.priceKurus, 0),
    staffIds,
  };
}

const weekdayOf = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

/** Randevuyu bloke eden durumlar: onaylı ya da onay süresi dolmamış bekleyen. */
export function activeAppointmentCondition(now: Date) {
  return or(eq(appointments.status, "CONFIRMED"), and(eq(appointments.status, "PENDING"), or(isNull(appointments.confirmDeadline), gt(appointments.confirmDeadline, now))));
}

/**
 * Bir gün için müsaitlik girdisini veritabanından yükler (seçimden bağımsız kısım).
 * ignoreAppointmentId: tarih değiştirmede randevunun kendisi meşgul sayılmaz.
 */
export async function loadDay(
  db: Executor,
  businessId: string,
  date: string,
  staffIds: string[],
  opts: { mode: BookingMode; now?: Date; ignoreAppointmentId?: string },
): Promise<Omit<DayInput, "durationMin"> & { settings: typeof businessSettings.$inferSelect }> {
  const now = opts.now ?? new Date();
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.businessId, businessId));
  if (!settings) throw notFound("İşletme ayarları");
  const today = todayTR(now);
  const weekday = weekdayOf(date);

  // En erken başlangıç dakikası
  let earliestMinute = 0;
  const horizon = opts.mode === "ONLINE" ? settings.maxAdvanceDays : 365;
  if (date < today || date > addDaysStr(today, horizon)) earliestMinute = 1440;
  else if (date === today) earliestMinute = opts.mode === "ONLINE" ? localMoment(now).minutes + settings.minLeadMin : 0;
  else if (opts.mode === "ONLINE" && settings.minLeadMin > 0) {
    // Ön süre ertesi güne taşabilir
    const lead = clipToDay(date, now, new Date(now.getTime() + settings.minLeadMin * 60_000));
    if (lead) earliestMinute = lead[1];
  }

  const weekly = await getWeeklyHours(db, businessId);
  const exceptions = await getExceptionMap(db, businessId, date, date);
  const businessOpen = rangesToIntervals(rangesForDay({ weekly, exceptions, tempClosedUntil: null }, date, weekday));
  const closed: Interval[] = [];
  if (settings.tempClosedUntil) {
    const c = clipToDay(date, new Date(0), settings.tempClosedUntil);
    if (c) closed.push(c);
  }

  const dayStart = dayStartUtc(date);
  const dayEnd = new Date(dayStart.getTime() + 1440 * 60_000);
  const staffDays: StaffDay[] = [];
  if (staffIds.length) {
    const [shifts, breaks, offs, appts] = [
      await db.select().from(staffShifts).where(and(eq(staffShifts.businessId, businessId), inArray(staffShifts.staffId, staffIds), eq(staffShifts.weekday, weekday))).orderBy(asc(staffShifts.startTime)),
      await db.select().from(staffBreaks).where(and(eq(staffBreaks.businessId, businessId), inArray(staffBreaks.staffId, staffIds), eq(staffBreaks.weekday, weekday))),
      await db
        .select()
        .from(staffTimeOff)
        .where(and(eq(staffTimeOff.businessId, businessId), inArray(staffTimeOff.staffId, staffIds), lt(staffTimeOff.startsAt, dayEnd), gt(staffTimeOff.endsAt, dayStart))),
      await db
        .select({ id: appointments.id, staffId: appointments.staffId, startsAt: appointments.startsAt, blockedUntil: appointments.blockedUntil })
        .from(appointments)
        .where(
          and(
            eq(appointments.businessId, businessId),
            inArray(appointments.staffId, staffIds),
            lt(appointments.startsAt, dayEnd),
            gt(appointments.blockedUntil, dayStart),
            activeAppointmentCondition(now),
            opts.ignoreAppointmentId ? sql`${appointments.id} <> ${opts.ignoreAppointmentId}` : undefined,
          ),
        ),
    ];
    for (const id of staffIds) {
      const toIv = (rows: { startTime: string; endTime: string }[]) => rangesToIntervals(rows.map((r) => ({ start: shortTime(r.startTime), end: shortTime(r.endTime) })));
      staffDays.push({
        staffId: id,
        shifts: toIv(shifts.filter((s) => s.staffId === id)),
        breaks: toIv(breaks.filter((s) => s.staffId === id)),
        timeOff: offs.filter((o) => o.staffId === id).map((o) => clipToDay(date, o.startsAt, o.endsAt)).filter((x): x is Interval => !!x),
        busy: appts.filter((a) => a.staffId === id).map((a) => clipToDay(date, a.startsAt, a.blockedUntil)).filter((x): x is Interval => !!x),
      });
    }
  }
  return { businessOpen, closed, staff: staffDays, bufferMin: settings.bufferMin, slotIntervalMin: settings.slotIntervalMin, earliestMinute, settings };
}

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih seçin.");

/** Seçim + tarih için müsait saatler (gerçek veritabanı kayıtlarına göre). */
export async function getAvailableSlots(
  db: Executor,
  businessId: string,
  input: { date: string; selection: Selection; staffId?: string | null; mode: BookingMode; ignoreAppointmentId?: string },
) {
  const sel = await resolveSelection(db, businessId, input.selection);
  let candidates = sel.staffIds;
  if (input.staffId) {
    if (!sel.staffIds.includes(input.staffId)) throw new AppError("VALIDATION", "Seçilen çalışan bu hizmeti vermiyor.");
    candidates = [input.staffId];
  }
  const day = await loadDay(db, businessId, input.date, candidates, { mode: input.mode, ignoreAppointmentId: input.ignoreAppointmentId });
  const slots = computeSlots({ ...day, durationMin: sel.durationMin });
  return { slots, durationMin: sel.durationMin, totalKurus: sel.totalKurus, items: sel.items, staffIds: candidates };
}
