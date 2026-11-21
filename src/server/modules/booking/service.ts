import "server-only";
import { and, asc, count, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { appointmentEvents, appointmentItems, appointments, businessCustomers, businesses, customers, staff } from "@/server/db/schema";
import { AppError, notFound, pgErrorCode, PG } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { getSetting } from "@/server/modules/platform/settings";
import { pushInbox } from "@/server/modules/business/inbox";
import { sendEmail } from "@/server/notifications/mailer";
import { apptTemplates, type ApptCtx } from "@/server/notifications/appointment-templates";
import { isStaffSlotValid, minuteToDate, clipToDay } from "@/lib/availability";
import { normalizeTrPhone } from "@/lib/phone";
import { loadDay, resolveSelection, type BookingMode, type Selection } from "./availability";
import { recomputeTrust } from "@/server/modules/trust/score";

export type Realm = "CUSTOMER" | "BUSINESS" | "ADMIN";
export type Actor = { realm: Realm | null; id: string | null; ip?: string | null };

/* ───────── Yardımcılar ───────── */

const localDateOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const localMinuteOf = (d: Date) => clipToDay(localDateOf(d), d, new Date(d.getTime() + 60_000))![0];

async function event(db: Executor, a: { id: string; businessId: string }, from: string | null, to: string, actor: Actor, note?: string | null) {
  await db.insert(appointmentEvents).values({
    appointmentId: a.id,
    businessId: a.businessId,
    fromStatus: from as never,
    toStatus: to as never,
    actorRealm: actor.realm,
    actorId: actor.id,
    note: note ?? null,
  });
}

/** E-posta/bildirim için randevu bağlamı. */
async function apptContext(db: Executor, id: string) {
  const [row] = await db
    .select({ a: appointments, businessName: businesses.name, businessEmail: businesses.email, staffName: staff.name, bc: businessCustomers, customerEmail: customers.email })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(businessCustomers, eq(businessCustomers.id, appointments.businessCustomerId))
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .where(eq(appointments.id, id));
  if (!row) return null;
  const items = await db.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, id)).orderBy(asc(appointmentItems.sortOrder));
  const ctx: ApptCtx = {
    businessName: row.businessName,
    staffName: row.staffName,
    services: items.map((i) => i.nameSnapshot).join(" + "),
    startsAt: row.a.startsAt,
    totalKurus: row.a.totalKurus,
    customerName: row.bc.displayName,
    deadline: row.a.confirmDeadline,
    note: row.a.cancelNote,
  };
  return { ...row, ctx, customerEmailTo: row.customerEmail ?? row.bc.email };
}

/** Bildirim hataları ana işlemi bozmaz. */
async function notify(db: Executor, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    logger.error("appointment_notify_failed", e);
  }
}

async function emailCustomer(db: Executor, apptId: string, kind: keyof typeof apptTemplates, dedupe: string) {
  const c = await apptContext(db, apptId);
  if (!c?.customerEmailTo) return;
  const t = apptTemplates[kind](c.ctx);
  await sendEmail(db, { ...t, to: c.customerEmailTo, template: `appointment.${kind}`, businessId: c.a.businessId, dedupeKey: `appt:${kind}:${apptId}:${dedupe}` });
}

async function emailBusiness(db: Executor, apptId: string, kind: keyof typeof apptTemplates, dedupe: string) {
  const c = await apptContext(db, apptId);
  if (!c?.businessEmail) return;
  const t = apptTemplates[kind](c.ctx);
  await sendEmail(db, { ...t, to: c.businessEmail, template: `appointment.${kind}`, businessId: c.a.businessId, dedupeKey: `appt:${kind}:${apptId}:${dedupe}` });
}

/* ───────── Süresi dolan onay talepleri ───────── */

/**
 * Onay süresi dolmuş "Bekliyor" randevuları "İptal (işletme onaylamadı)" yapar ve müşteriye bildirir.
 * Randevu oluşturmadan önce, takvim açılırken ve günlük görevde çağrılır (idempotent).
 */
export async function expireOverduePendings(db: DB, scope: { businessId?: string; staffId?: string } = {}, now = new Date()) {
  const conds = [eq(appointments.status, "PENDING"), lte(appointments.confirmDeadline, now)];
  if (scope.businessId) conds.push(eq(appointments.businessId, scope.businessId));
  if (scope.staffId) conds.push(eq(appointments.staffId, scope.staffId));
  const expired = await db
    .update(appointments)
    .set({ status: "CANCELLED", cancelledAt: now, cancelReason: "NOT_CONFIRMED_IN_TIME", updatedAt: now })
    .where(and(...conds))
    .returning({ id: appointments.id, businessId: appointments.businessId });
  for (const bid of new Set(expired.map((a) => a.businessId))) await notify(db, () => recomputeTrust(db, bid));
  for (const a of expired) {
    await event(db, a, "PENDING", "CANCELLED", { realm: null, id: null }, "Onay süresi doldu");
    await notify(db, async () => {
      await emailCustomer(db, a.id, "expired", "1");
      await pushInbox(db, a.businessId, { kind: "GENERAL", title: "Bir randevu talebi onaylanmadığı için iptal oldu", body: "Talepleri süresi içinde onaylamak güven puanınızı korur.", link: `/isletme/panel/randevular/${a.id}` });
    });
  }
  return expired.length;
}

/* ───────── Oluşturma ───────── */

export type CustomerRef = { customerId: string } | { businessCustomerId: string } | { guest: { name: string; phone?: string | null } };

export const guestSchema = z.object({
  name: z.string().trim().min(2, "Müşteri adı en az 2 karakter olmalı.").max(80),
  phone: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional())
    .transform((v, ctx) => {
      if (!v) return null;
      const n = normalizeTrPhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Geçerli bir telefon girin." });
        return z.NEVER;
      }
      return n;
    }),
});

async function resolveBusinessCustomer(tx: Executor, businessId: string, ref: CustomerRef): Promise<{ id: string; customerId: string | null }> {
  if ("businessCustomerId" in ref) {
    const [bc] = await tx.select().from(businessCustomers).where(and(eq(businessCustomers.id, ref.businessCustomerId), eq(businessCustomers.businessId, businessId)));
    if (!bc) throw new AppError("VALIDATION", "Müşteri bulunamadı.");
    return { id: bc.id, customerId: bc.customerId };
  }
  if ("customerId" in ref) {
    const [c] = await tx.select().from(customers).where(eq(customers.id, ref.customerId));
    if (!c || c.deletedAt) throw new AppError("UNAUTHENTICATED", "Bu işlem için giriş yapmanız gerekiyor.");
    const [bc] = await tx
      .insert(businessCustomers)
      .values({ businessId, customerId: c.id, displayName: c.name, phone: c.phone, email: c.email })
      .onConflictDoUpdate({
        target: [businessCustomers.businessId, businessCustomers.customerId],
        targetWhere: sql`${businessCustomers.customerId} IS NOT NULL`,
        set: { displayName: c.name, phone: c.phone, email: c.email },
      })
      .returning({ id: businessCustomers.id });
    return { id: bc!.id, customerId: c.id };
  }
  // Hesapsız müşteri (yalnızca panel): aynı telefonla kayıt varsa onu kullan
  if (ref.guest.phone) {
    const [existing] = await tx.select().from(businessCustomers).where(and(eq(businessCustomers.businessId, businessId), eq(businessCustomers.phone, ref.guest.phone)));
    if (existing) return { id: existing.id, customerId: existing.customerId };
  }
  const [bc] = await tx.insert(businessCustomers).values({ businessId, displayName: ref.guest.name, phone: ref.guest.phone ?? null }).returning({ id: businessCustomers.id });
  return { id: bc!.id, customerId: null };
}

export type CreateInput = {
  businessId: string;
  mode: BookingMode;
  actor: Actor;
  customer: CustomerRef;
  selection: Selection;
  staffId: string | null;
  startsAt: Date;
  customerNote?: string | null;
  internalNote?: string | null;
  idempotencyKey?: string | null;
};

/**
 * Randevu oluşturma (atomik).
 * - Online randevu yalnızca kimliği doğrulanmış müşteri için ve yalnızca slot ızgarasındaki saatlere oluşturulur; durum "Bekliyor".
 * - Panelden işletme oluşturur (hesapsız müşteri olabilir); durum "Onaylandı".
 * - Uygunluk transaction içinde YENİDEN hesaplanır; son güvence veritabanının EXCLUDE kısıtıdır.
 * - Çalışan seçilmediyse uygun çalışanlar o günkü yükü en az olandan başlanarak denenir.
 */
export async function createAppointment(db: DB, input: CreateInput) {
  if (input.mode === "ONLINE" && !("customerId" in input.customer)) throw new AppError("UNAUTHENTICATED", "Randevu almak için giriş yapmanız gerekiyor.");
  if (input.mode === "PANEL" && "customerId" in input.customer) throw new AppError("VALIDATION", "Geçersiz müşteri.");

  if (input.idempotencyKey) {
    const [dup] = await db.select().from(appointments).where(eq(appointments.idempotencyKey, input.idempotencyKey));
    if (dup) {
      if (dup.businessId !== input.businessId) throw new AppError("CONFLICT", "İstek tekrarlandı.");
      return dup;
    }
  }

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, input.businessId));
  if (!biz) throw notFound("İşletme");
  if (input.mode === "ONLINE" && !(biz.status === "ACTIVE" && biz.isPublished)) throw new AppError("VALIDATION", "Bu işletme şu an online randevu almıyor.");

  const sel = await resolveSelection(db, input.businessId, input.selection);
  let candidates = sel.staffIds;
  if (input.staffId) {
    if (!candidates.includes(input.staffId)) throw new AppError("VALIDATION", "Seçilen çalışan bu hizmeti vermiyor.");
    candidates = [input.staffId];
  }
  if (!candidates.length) throw new AppError("VALIDATION", "Bu hizmet için müsait çalışan yok.");

  const date = localDateOf(input.startsAt);
  const minute = localMinuteOf(input.startsAt);
  if (minute % 5 !== 0) throw new AppError("VALIDATION", "Saat 5 dakikanın katı olmalı.");

  // Çalışan yoksa yükü en az olandan başla
  if (!input.staffId && candidates.length > 1) {
    const dayStart = minuteToDate(date, 0);
    const loads = await db
      .select({ staffId: appointments.staffId, n: count() })
      .from(appointments)
      .where(and(inArray(appointments.staffId, candidates), gte(appointments.startsAt, dayStart), lt(appointments.startsAt, minuteToDate(date, 1440)), inArray(appointments.status, ["PENDING", "CONFIRMED"])))
      .groupBy(appointments.staffId);
    candidates = [...candidates].sort((a, b) => (loads.find((l) => l.staffId === a)?.n ?? 0) - (loads.find((l) => l.staffId === b)?.n ?? 0));
  }

  const confirmHours = await getSetting(db, "booking.confirmWindowHours");
  const now = new Date();
  let lastReason = "Seçilen saat artık müsait değil. Lütfen başka bir saat seçin.";

  for (const staffId of candidates) {
    // Bu çalışanın süresi dolmuş bekleyen talepleri DB kısıtını işgal etmesin
    await expireOverduePendings(db, { staffId }, now);
    try {
      const created = await db.transaction(async (tx) => {
        const day = await loadDay(tx, input.businessId, date, [staffId], { mode: input.mode, now });
        if (input.mode === "ONLINE" && minute % day.settings.slotIntervalMin !== 0) throw new AppError("VALIDATION", "Geçersiz saat seçimi.");
        const s = day.staff[0]!;
        if (!isStaffSlotValid({ ...day, durationMin: sel.durationMin }, s, minute)) {
          throw new AppError("CONFLICT", lastReason);
        }
        const bc = await resolveBusinessCustomer(tx, input.businessId, input.customer);
        const startsAt = minuteToDate(date, minute);
        const endsAt = new Date(startsAt.getTime() + sel.durationMin * 60_000);
        const blockedUntil = new Date(endsAt.getTime() + day.settings.bufferMin * 60_000);
        const status = input.mode === "ONLINE" ? "PENDING" : "CONFIRMED";
        const confirmDeadline = status === "PENDING" ? new Date(Math.min(now.getTime() + confirmHours * 3_600_000, startsAt.getTime())) : null;
        const [a] = await tx
          .insert(appointments)
          .values({
            businessId: input.businessId,
            staffId,
            businessCustomerId: bc.id,
            customerId: bc.customerId,
            startsAt,
            endsAt,
            blockedUntil,
            status,
            source: input.mode,
            confirmDeadline,
            confirmedAt: status === "CONFIRMED" ? now : null,
            totalKurus: sel.totalKurus,
            customerNote: input.customerNote ?? null,
            internalNote: input.internalNote ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
          })
          .returning();
        await tx.insert(appointmentItems).values(
          sel.items.map((it, i) => ({
            appointmentId: a!.id,
            serviceId: it.serviceId,
            packageId: it.packageId,
            nameSnapshot: it.name,
            priceSnapshotKurus: it.priceKurus,
            durationSnapshotMin: it.durationMin,
            sortOrder: i,
          })),
        );
        await event(tx, a!, null, status, input.actor);
        return a!;
      });

      if (created.status === "PENDING") {
        await notify(db, async () => {
          await emailCustomer(db, created.id, "requestReceived", "1");
          await emailBusiness(db, created.id, "newRequestForBusiness", "1");
          await pushInbox(db, created.businessId, { kind: "GENERAL", title: "Yeni randevu talebi", body: "Onay süresi dolmadan onaylayın ya da reddedin.", link: `/isletme/panel/randevular/${created.id}` });
        });
      }
      return created;
    } catch (e) {
      if (pgErrorCode(e) === PG.EXCLUSION_VIOLATION || (e instanceof AppError && e.code === "CONFLICT")) {
        continue; // sıradaki uygun çalışanı dene
      }
      if (pgErrorCode(e) === PG.UNIQUE_VIOLATION && input.idempotencyKey) {
        const [dup] = await db.select().from(appointments).where(eq(appointments.idempotencyKey, input.idempotencyKey));
        if (dup) return dup;
      }
      throw e;
    }
  }
  throw new AppError("CONFLICT", lastReason);
}

/* ───────── Durum geçişleri ───────── */

type Status = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

async function lockOwn(tx: Executor, id: string, scope: { businessId?: string; customerId?: string }) {
  const conds = [eq(appointments.id, id)];
  if (scope.businessId) conds.push(eq(appointments.businessId, scope.businessId));
  if (scope.customerId) conds.push(eq(appointments.customerId, scope.customerId));
  const [a] = await tx.select().from(appointments).where(and(...conds)).for("update");
  if (!a) throw notFound("Randevu");
  return a;
}

function assertFrom(a: { status: Status }, allowed: Status[], msg: string) {
  if (!allowed.includes(a.status)) throw new AppError("CONFLICT", msg);
}

/** İşletme: onayla. Onay süresi dolmuşsa reddedilir. */
export async function confirmAppointment(db: DB, businessId: string, id: string, actor: Actor) {
  const a = await db.transaction(async (tx) => {
    const a = await lockOwn(tx, id, { businessId });
    assertFrom(a, ["PENDING"], "Yalnızca onay bekleyen randevular onaylanabilir.");
    if (a.confirmDeadline && a.confirmDeadline <= new Date()) throw new AppError("CONFLICT", "Onay süresi dolmuş; talep otomatik iptal edildi.");
    await tx.update(appointments).set({ status: "CONFIRMED", confirmedAt: new Date(), updatedAt: new Date() }).where(eq(appointments.id, id));
    await event(tx, a, "PENDING", "CONFIRMED", actor);
    return a;
  });
  await notify(db, () => emailCustomer(db, a.id, "confirmed", String(Date.now())));
  await notify(db, () => recomputeTrust(db, businessId));
}

/** İşletme: talebi reddet ya da onaylı randevuyu iptal et (saat yeniden müsait olur). */
export async function cancelByBusiness(db: DB, businessId: string, id: string, actor: Actor, note?: string | null) {
  const prev = await db.transaction(async (tx) => {
    const a = await lockOwn(tx, id, { businessId });
    assertFrom(a, ["PENDING", "CONFIRMED"], "Bu randevu iptal edilemez.");
    await tx.update(appointments).set({ status: "CANCELLED", cancelledAt: new Date(), cancelReason: "BUSINESS", cancelNote: note ?? null, updatedAt: new Date() }).where(eq(appointments.id, id));
    await event(tx, a, a.status, "CANCELLED", actor, note);
    return a.status;
  });
  await notify(db, () => emailCustomer(db, id, prev === "PENDING" ? "rejected" : "cancelledByBusiness", "1"));
  await notify(db, () => recomputeTrust(db, businessId));
}

/** İşletme: tamamlandı / gelmedi (yalnızca başlama saati geçmiş onaylı randevu). */
export async function finalizeAppointment(db: DB, businessId: string, id: string, to: "COMPLETED" | "NO_SHOW", actor: Actor) {
  await db.transaction(async (tx) => {
    const a = await lockOwn(tx, id, { businessId });
    assertFrom(a, ["CONFIRMED"], "Yalnızca onaylı randevular sonuçlandırılabilir.");
    if (a.startsAt > new Date()) throw new AppError("VALIDATION", "Randevu saati gelmeden sonuçlandırılamaz.");
    await tx.update(appointments).set({ status: to, updatedAt: new Date() }).where(eq(appointments.id, id));
    if (to === "COMPLETED") {
      await tx
        .update(businessCustomers)
        .set({
          visitCount: sql`${businessCustomers.visitCount} + 1`,
          lastVisitAt: a.startsAt,
          firstVisitAt: sql`coalesce(${businessCustomers.firstVisitAt}, ${a.startsAt})`,
        })
        .where(eq(businessCustomers.id, a.businessCustomerId));
    }
    await event(tx, a, "CONFIRMED", to, actor);
  });
  await notify(db, () => recomputeTrust(db, businessId));
}

/** Müşteri: kendi randevusunu iptal eder (randevuya 2 saatten fazla varsa). */
export async function cancelByCustomer(db: DB, customerId: string, id: string, actor: Actor) {
  const cutoff = await getSetting(db, "booking.customerCancelCutoffMinutes");
  const a = await db.transaction(async (tx) => {
    const a = await lockOwn(tx, id, { customerId });
    assertFrom(a, ["PENDING", "CONFIRMED"], "Bu randevu iptal edilemez.");
    if (a.startsAt.getTime() - Date.now() < cutoff * 60_000)
      throw new AppError("VALIDATION", `Randevuya ${Math.round(cutoff / 60)} saatten az kaldığı için çevrimiçi iptal yapılamaz. Lütfen işletmeyi arayın.`);
    await tx.update(appointments).set({ status: "CANCELLED", cancelledAt: new Date(), cancelReason: "CUSTOMER", updatedAt: new Date() }).where(eq(appointments.id, id));
    await event(tx, a, a.status, "CANCELLED", actor);
    return a;
  });
  await notify(db, async () => {
    await emailBusiness(db, id, "cancelledByCustomerForBusiness", "1");
    await pushInbox(db, a.businessId, { kind: "GENERAL", title: "Bir müşteri randevusunu iptal etti", link: `/isletme/panel/randevular/${id}` });
  });
}

/**
 * Tarih/saat/çalışan değişikliği. İşletme yaparsa durum korunur; müşteri yaparsa (2 saat kuralı) talep yeniden "Bekliyor" olur.
 * Yeni saat transaction içinde yeniden doğrulanır; çakışmayı EXCLUDE kısıtı da engeller.
 */
export async function rescheduleAppointment(
  db: DB,
  scope: { businessId: string } | { customerId: string },
  id: string,
  input: { startsAt: Date; staffId?: string | null },
  actor: Actor,
) {
  const byCustomer = "customerId" in scope;
  const cutoff = await getSetting(db, "booking.customerCancelCutoffMinutes");
  const confirmHours = await getSetting(db, "booking.confirmWindowHours");
  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const a = await lockOwn(tx, id, scope);
    assertFrom(a, ["PENDING", "CONFIRMED"], "Bu randevu değiştirilemez.");
    if (byCustomer && a.startsAt.getTime() - now.getTime() < cutoff * 60_000)
      throw new AppError("VALIDATION", `Randevuya ${Math.round(cutoff / 60)} saatten az kaldığı için çevrimiçi değişiklik yapılamaz.`);
    const items = await tx.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, id));
    const selection: Selection = items[0]?.packageId
      ? { packageId: items[0].packageId, serviceIds: [] }
      : { serviceIds: items.map((i) => i.serviceId).filter((x): x is string => !!x) };
    const sel = await resolveSelection(tx, a.businessId, selection);
    const staffId = input.staffId ?? a.staffId;
    if (!sel.staffIds.includes(staffId)) throw new AppError("VALIDATION", "Seçilen çalışan bu hizmeti vermiyor.");
    const date = localDateOf(input.startsAt);
    const minute = localMinuteOf(input.startsAt);
    const day = await loadDay(tx, a.businessId, date, [staffId], { mode: byCustomer ? "ONLINE" : "PANEL", now, ignoreAppointmentId: id });
    if (!isStaffSlotValid({ ...day, durationMin: a.endsAt.getTime() / 60_000 - a.startsAt.getTime() / 60_000 }, day.staff[0]!, minute))
      throw new AppError("CONFLICT", "Seçilen saat müsait değil.");
    const startsAt = minuteToDate(date, minute);
    const dur = a.endsAt.getTime() - a.startsAt.getTime();
    const endsAt = new Date(startsAt.getTime() + dur);
    const next: Status = byCustomer ? "PENDING" : a.status;
    try {
      await tx
        .update(appointments)
        .set({
          staffId,
          startsAt,
          endsAt,
          blockedUntil: new Date(endsAt.getTime() + day.settings.bufferMin * 60_000),
          status: next,
          confirmDeadline: next === "PENDING" ? new Date(Math.min(now.getTime() + confirmHours * 3_600_000, startsAt.getTime())) : a.confirmDeadline,
          confirmedAt: next === "PENDING" ? null : a.confirmedAt,
          updatedAt: now,
        })
        .where(eq(appointments.id, id));
    } catch (e) {
      if (pgErrorCode(e) === PG.EXCLUSION_VIOLATION) throw new AppError("CONFLICT", "Seçilen saat müsait değil.");
      throw e;
    }
    await event(tx, a, a.status, next, actor, `Yeni zaman: ${startsAt.toISOString()}`);
    return a;
  });
  await notify(db, async () => {
    if (byCustomer) {
      await emailBusiness(db, id, "rescheduledByCustomerForBusiness", String(now.getTime()));
      await pushInbox(db, updated.businessId, { kind: "GENERAL", title: "Bir müşteri randevusunu değiştirdi", body: "Yeni talep onayınızı bekliyor.", link: `/isletme/panel/randevular/${id}` });
    } else await emailCustomer(db, id, "rescheduled", String(now.getTime()));
  });
}

/** İşletmenin iç notu (müşteri görmez). */
export async function setInternalNote(db: DB, businessId: string, id: string, note: string | null) {
  const r = await db
    .update(appointments)
    .set({ internalNote: note, updatedAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.businessId, businessId)))
    .returning({ id: appointments.id });
  if (!r.length) throw notFound("Randevu");
}

/** Yarınki onaylı randevular için hatırlatma e-postası (günlük görev). */
export async function sendTomorrowReminders(db: DB, now = new Date()) {
  const tomorrow = localDateOf(new Date(now.getTime() + 86_400_000));
  const from = minuteToDate(tomorrow, 0);
  const to = minuteToDate(tomorrow, 1440);
  const list = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.status, "CONFIRMED"), gte(appointments.startsAt, from), lt(appointments.startsAt, to)));
  for (const a of list) await notify(db, () => emailCustomer(db, a.id, "reminder", tomorrow));
  return list.length;
}
