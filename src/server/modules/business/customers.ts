import "server-only";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { appointmentItems, appointments, businessCustomers, staff } from "@/server/db/schema";
import { notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { optionalText } from "@/lib/validation/common";
import { bizAudit, type Biz } from "./context";

const PAGE = 30;
const likeOf = (q: string) => `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

/** İşletmenin müşterileri (yalnızca kendisinden randevu almış ya da panelden eklenmiş). */
export async function listBusinessCustomers(db: Executor, businessId: string, f: { q?: string; page?: number } = {}) {
  const conds = [eq(businessCustomers.businessId, businessId)];
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    conds.push(or(ilike(businessCustomers.displayName, likeOf(f.q)), ...(digits.length >= 3 ? [ilike(businessCustomers.phone, `%${digits}%`)] : []))!);
  }
  const page = Math.max(1, f.page ?? 1);
  const [rows, [total]] = [
    await db
      .select()
      .from(businessCustomers)
      .where(and(...conds))
      .orderBy(sql`${businessCustomers.lastVisitAt} DESC NULLS LAST`, asc(businessCustomers.displayName))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    await db.select({ n: count() }).from(businessCustomers).where(and(...conds)),
  ];
  return { rows, total: total?.n ?? 0, page, pageSize: PAGE };
}

/** Randevu formundaki müşteri arama (en fazla 8 sonuç). */
export function searchCustomers(db: Executor, businessId: string, q: string) {
  const digits = q.replace(/\D/g, "");
  return db
    .select({ id: businessCustomers.id, name: businessCustomers.displayName, phone: businessCustomers.phone, hasAccount: sql<boolean>`${businessCustomers.customerId} IS NOT NULL` })
    .from(businessCustomers)
    .where(and(eq(businessCustomers.businessId, businessId), or(ilike(businessCustomers.displayName, likeOf(q)), ...(digits.length >= 3 ? [ilike(businessCustomers.phone, `%${digits}%`)] : []))))
    .orderBy(asc(businessCustomers.displayName))
    .limit(8);
}

export async function getCustomerDetail(db: Executor, businessId: string, id: string) {
  const [c] = await db.select().from(businessCustomers).where(and(eq(businessCustomers.id, id), eq(businessCustomers.businessId, businessId)));
  if (!c) throw notFound("Müşteri");
  const history = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      totalKurus: appointments.totalKurus,
      staffName: staff.name,
      services: sql<string>`(SELECT string_agg(${appointmentItems.nameSnapshot}, ' + ' ORDER BY ${appointmentItems.sortOrder}) FROM ${appointmentItems} WHERE ${appointmentItems.appointmentId} = ${appointments.id})`,
    })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .where(and(eq(appointments.businessId, businessId), eq(appointments.businessCustomerId, id)))
    .orderBy(desc(appointments.startsAt))
    .limit(100);
  const spent = history.filter((h) => h.status === "COMPLETED").reduce((a, h) => a + h.totalKurus, 0);
  const noShows = history.filter((h) => h.status === "NO_SHOW").length;
  return { ...c, history, spentKurus: spent, noShows };
}

export const customerNotesSchema = z.object({ notes: optionalText(2000, "Not") });

/** Müşteri notu yalnızca bu işletmeye özeldir. */
export async function updateCustomerNotes(db: DB, biz: Biz, id: string, notes: string | null) {
  const r = await db
    .update(businessCustomers)
    .set({ notes })
    .where(and(eq(businessCustomers.id, id), eq(businessCustomers.businessId, biz.businessId)))
    .returning({ id: businessCustomers.id });
  if (!r.length) throw notFound("Müşteri");
  await audit(db, { ...bizAudit(biz), action: "customer.notes_update", entity: "business_customer", entityId: id });
}
