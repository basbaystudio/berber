import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { appointmentEvents, appointmentItems, appointments, businessCustomers, staff } from "@/server/db/schema";
import { notFound } from "@/server/lib/errors";
import { minuteToDate } from "@/lib/availability";
import { addDaysStr, todayTR } from "@/lib/dates";

export type ApptRow = Awaited<ReturnType<typeof listAppointments>>[number];

/** Tarih aralığındaki randevular (yalnızca bu işletmenin). */
export async function listAppointments(
  db: Executor,
  businessId: string,
  range: { from: Date; to: Date },
  f: { staffId?: string; statuses?: ("PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW")[] } = {},
) {
  const conds = [eq(appointments.businessId, businessId), gte(appointments.startsAt, range.from), lt(appointments.startsAt, range.to)];
  if (f.staffId) conds.push(eq(appointments.staffId, f.staffId));
  if (f.statuses?.length) conds.push(inArray(appointments.status, f.statuses));
  const rows = await db
    .select({
      id: appointments.id,
      staffId: appointments.staffId,
      staffName: staff.name,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      source: appointments.source,
      totalKurus: appointments.totalKurus,
      confirmDeadline: appointments.confirmDeadline,
      customerName: businessCustomers.displayName,
      customerPhone: businessCustomers.phone,
      businessCustomerId: appointments.businessCustomerId,
      services: sql<string>`(SELECT string_agg(${appointmentItems.nameSnapshot}, ' + ' ORDER BY ${appointmentItems.sortOrder}) FROM ${appointmentItems} WHERE ${appointmentItems.appointmentId} = ${appointments.id})`,
    })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(businessCustomers, eq(businessCustomers.id, appointments.businessCustomerId))
    .where(and(...conds))
    .orderBy(asc(appointments.startsAt));
  return rows;
}

export function listPendingRequests(db: Executor, businessId: string) {
  return listAppointments(db, businessId, { from: new Date("2000-01-01T00:00:00Z"), to: new Date("9999-12-31T00:00:00Z") }, { statuses: ["PENDING"] });
}

export async function getAppointmentDetail(db: Executor, businessId: string, id: string) {
  const [row] = await db
    .select({ a: appointments, staffName: staff.name, bc: businessCustomers })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(businessCustomers, eq(businessCustomers.id, appointments.businessCustomerId))
    .where(and(eq(appointments.id, id), eq(appointments.businessId, businessId)));
  if (!row) throw notFound("Randevu");
  const [items, events] = [
    await db.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, id)).orderBy(asc(appointmentItems.sortOrder)),
    await db.select().from(appointmentEvents).where(eq(appointmentEvents.appointmentId, id)).orderBy(desc(appointmentEvents.createdAt)),
  ];
  return { ...row, items, events };
}

/** İşletme genel bakış metrikleri (Türkiye saatine göre gün/ay). */
export async function getDashboardMetrics(db: Executor, businessId: string) {
  const today = todayTR();
  const dayFrom = minuteToDate(today, 0);
  const dayTo = minuteToDate(addDaysStr(today, 1), 0);
  const monthStart = minuteToDate(`${today.slice(0, 8)}01`, 0);
  const r = await db.execute<Record<string, string | number>>(sql`
    SELECT
      count(*) FILTER (WHERE starts_at >= ${dayFrom} AND starts_at < ${dayTo} AND status IN ('PENDING','CONFIRMED','COMPLETED','NO_SHOW'))::int AS today,
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
      count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
      count(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
      count(*) FILTER (WHERE status = 'NO_SHOW')::int AS no_show,
      coalesce(sum(total_kurus) FILTER (WHERE status = 'COMPLETED' AND starts_at >= ${dayFrom} AND starts_at < ${dayTo}), 0)::bigint AS rev_today,
      coalesce(sum(total_kurus) FILTER (WHERE status = 'COMPLETED' AND starts_at >= ${monthStart}), 0)::bigint AS rev_month,
      coalesce(sum(total_kurus) FILTER (WHERE status IN ('CONFIRMED','COMPLETED') AND starts_at >= ${dayFrom} AND starts_at < ${dayTo}), 0)::bigint AS expected_today
    FROM appointments WHERE business_id = ${businessId}`);
  const x = r.rows[0]!;
  const n = (k: string) => Number(x[k] ?? 0);
  return {
    today: n("today"),
    total: n("total"),
    pending: n("pending"),
    completed: n("completed"),
    cancelled: n("cancelled"),
    noShow: n("no_show"),
    revenueTodayKurus: n("rev_today"),
    revenueMonthKurus: n("rev_month"),
    expectedTodayKurus: n("expected_today"),
  };
}
