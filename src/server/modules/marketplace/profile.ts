import "server-only";
import { listShopPhotos } from "@/server/modules/shop-photos";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { businesses, districts, favorites, monthlyAwards, portfolioCategories, portfolioPhotos, provinces, reviews, serviceTypes, services, staff, customers } from "@/server/db/schema";
import { listPackages } from "@/server/modules/business/catalog";
import { getExceptionMap, getWeeklyHours, loadOpenStateInput } from "@/server/modules/business/hours";
import { computeOpenState } from "@/lib/schedule";
import { addDaysStr, todayTR } from "@/lib/dates";
import { publicCondition } from "./search";

/** Herkese açık işletme profili (yalnızca yayındaki ve aktif işletmeler). */
export async function getPublicProfile(db: Executor, slug: string, customerId?: string | null) {
  const [row] = await db
    .select({ b: businesses, province: provinces.name, district: districts.name })
    .from(businesses)
    .innerJoin(provinces, eq(provinces.id, businesses.provinceId))
    .innerJoin(districts, eq(districts.id, businesses.districtId))
    .where(and(eq(businesses.slug, slug), publicCondition))
    .limit(1);
  if (!row) return null;
  const b = row.b;
  const today = todayTR();
  const [svc, pkgs, team, photos, cats, weekly, exceptions, openInput, revs, awards, fav] = [
    await db
      .select({ id: services.id, name: services.name, description: services.description, priceKurus: services.priceKurus, durationMin: services.durationMin, typeName: serviceTypes.name })
      .from(services)
      .leftJoin(serviceTypes, eq(serviceTypes.id, services.serviceTypeId))
      .where(and(eq(services.businessId, b.id), eq(services.isActive, true), isNull(services.deletedAt)))
      .orderBy(asc(services.sortOrder), asc(services.name)),
    (await listPackages(db, b.id)).filter((p) => p.isActive),
    await db
      .select({ id: staff.id, name: staff.name, title: staff.title, bio: staff.bio, photoUrl: staff.photoUrl })
      .from(staff)
      .where(and(eq(staff.businessId, b.id), eq(staff.isActive, true), isNull(staff.deletedAt)))
      .orderBy(asc(staff.sortOrder), asc(staff.name)),
    await db
      .select({ id: portfolioPhotos.id, url: portfolioPhotos.url, caption: portfolioPhotos.caption, categoryId: portfolioPhotos.categoryId, staffId: portfolioPhotos.staffId, width: portfolioPhotos.width, height: portfolioPhotos.height })
      .from(portfolioPhotos)
      .where(eq(portfolioPhotos.businessId, b.id))
      .orderBy(asc(portfolioPhotos.sortOrder)),
    await db.select({ id: portfolioCategories.id, name: portfolioCategories.name }).from(portfolioCategories).where(eq(portfolioCategories.businessId, b.id)).orderBy(asc(portfolioCategories.sortOrder)),
    await getWeeklyHours(db, b.id),
    await getExceptionMap(db, b.id, today, addDaysStr(today, 14)),
    await loadOpenStateInput(db, b.id),
    await db
      .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, reply: reviews.businessReply, repliedAt: reviews.repliedAt, createdAt: reviews.createdAt, customerName: customers.name, staffName: staff.name })
      .from(reviews)
      .leftJoin(customers, eq(customers.id, reviews.customerId))
      .leftJoin(staff, eq(staff.id, reviews.staffId))
      .where(and(eq(reviews.businessId, b.id), eq(reviews.status, "VISIBLE")))
      .orderBy(desc(reviews.createdAt))
      .limit(30),
    await db.select({ month: monthlyAwards.month }).from(monthlyAwards).where(eq(monthlyAwards.businessId, b.id)).orderBy(desc(monthlyAwards.month)),
    customerId ? await db.select().from(favorites).where(and(eq(favorites.customerId, customerId), eq(favorites.businessId, b.id))) : [],
  ];
  // Yorum yapanın adı kısaltılır (KVKK: "Ahmet Y.")
  const shortName = (n: string | null) => {
    if (!n) return "Müşteri";
    const parts = n.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts.at(-1)!.charAt(0)}.` : parts[0]!;
  };
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    phone: b.phone,
    addressLine: b.addressLine,
    province: row.province,
    district: row.district,
    latitude: b.latitude,
    longitude: b.longitude,
    logoUrl: b.logoUrl,
    coverUrl: b.coverUrl,
    ratingAvg: Number(b.ratingAvg),
    ratingCount: b.ratingCount,
    services: svc,
    packages: pkgs.map((p) => ({ id: p.id, name: p.name, description: p.description, priceKurus: p.priceKurus, durationMin: p.durationMin, items: p.items.map((i) => i.name) })),
    staff: team,
    photos,
    shopPhotos: (await listShopPhotos(db, b.id)).map((x) => ({ id: x.id, url: x.url, caption: null, categoryId: x.kind })),
    categories: cats,
    weekly,
    exceptions,
    open: computeOpenState(openInput, new Date()),
    tempClosedNote: openInput.tempClosedUntil && openInput.tempClosedUntil > new Date() ? openInput.tempClosedNote : null,
    reviews: revs.map((r) => ({ ...r, customerName: shortName(r.customerName) })),
    awards: awards.map((a) => a.month),
    isFavorite: fav.length > 0,
  };
}
export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/** Sihirbaz için seçim verisi: hizmetler + çalışan yetkinlikleri (kimlikler dışında iç bilgi yok). */
export async function getBookingCatalog(db: Executor, slug: string) {
  const p = await getPublicProfile(db, slug);
  if (!p) return null;
  const { listServices } = await import("@/server/modules/business/catalog");
  const all = await listServices(db, p.id);
  const activeStaff = new Set(p.staff.map((s) => s.id));
  return {
    profile: p,
    services: p.services.map((s) => ({ ...s, staffIds: (all.find((x) => x.id === s.id)?.staffIds ?? []).filter((id) => activeStaff.has(id)) })),
    packages: (await listPackages(db, p.id)).filter((x) => x.isActive).map((x) => ({ id: x.id, name: x.name, priceKurus: x.priceKurus, durationMin: x.durationMin, items: x.items.map((i) => i.name), staffIds: x.staffIds.filter((id) => activeStaff.has(id)) })),
  };
}
