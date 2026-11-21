import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { appointmentItems, appointments, businesses, favorites, reviews, staff } from "@/server/db/schema";
import { getSetting } from "@/server/modules/platform/settings";
import { searchBusinesses, enrichCards, type BusinessCard } from "@/server/modules/marketplace/search";

/** Müşterinin kendi randevuları (yalnızca kendisininki). */
export async function listMyAppointments(db: Executor, customerId: string) {
  const cutoff = await getSetting(db, "booking.customerCancelCutoffMinutes");
  const rows = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      totalKurus: appointments.totalKurus,
      cancelReason: appointments.cancelReason,
      cancelNote: appointments.cancelNote,
      confirmDeadline: appointments.confirmDeadline,
      staffId: appointments.staffId,
      staffName: staff.name,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      businessPhone: businesses.phone,
      services: sql<string>`(SELECT string_agg(${appointmentItems.nameSnapshot}, ' + ' ORDER BY ${appointmentItems.sortOrder}) FROM ${appointmentItems} WHERE ${appointmentItems.appointmentId} = ${appointments.id})`,
      serviceIds: sql<string[]>`(SELECT coalesce(array_agg(${appointmentItems.serviceId}) FILTER (WHERE ${appointmentItems.serviceId} IS NOT NULL), '{}') FROM ${appointmentItems} WHERE ${appointmentItems.appointmentId} = ${appointments.id})`,
      packageId: sql<string | null>`(SELECT max(${appointmentItems.packageId}::text) FROM ${appointmentItems} WHERE ${appointmentItems.appointmentId} = ${appointments.id})`,
      reviewId: reviews.id,
      reviewRating: reviews.rating,
    })
    .from(appointments)
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .leftJoin(reviews, eq(reviews.appointmentId, appointments.id))
    .where(eq(appointments.customerId, customerId))
    .orderBy(desc(appointments.startsAt))
    .limit(200);
  const now = Date.now();
  const enriched = rows.map((r) => {
    const active = r.status === "PENDING" || r.status === "CONFIRMED";
    return {
      ...r,
      canChange: active && r.startsAt.getTime() - now >= cutoff * 60_000,
      canReview: r.status === "COMPLETED" && !r.reviewId && now - r.startsAt.getTime() < 60 * 86_400_000,
    };
  });
  return {
    upcoming: enriched.filter((r) => (r.status === "PENDING" || r.status === "CONFIRMED") && r.endsAt.getTime() > now).reverse(),
    past: enriched.filter((r) => !((r.status === "PENDING" || r.status === "CONFIRMED") && r.endsAt.getTime() > now)),
    cutoffMin: cutoff,
  };
}

/** Favori işletmeler (yalnızca hâlâ yayında olanlar kart olarak). */
export async function listMyFavorites(db: Executor, customerId: string) {
  const favIds = (await db.select({ id: favorites.businessId }).from(favorites).where(eq(favorites.customerId, customerId))).map((f) => f.id);
  if (!favIds.length) return [];
  const { cards } = await searchBusinesses(db, { sirala: "onerilen", sayfa: 1, bugun: false }, { limit: 200 });
  const mine: BusinessCard[] = cards.filter((c) => favIds.includes(c.id));
  return enrichCards(mine);
}

export async function isMyAppointment(db: Executor, customerId: string, id: string) {
  const [a] = await db.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.id, id), eq(appointments.customerId, customerId)));
  return !!a;
}
