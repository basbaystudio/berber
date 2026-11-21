import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { packageItems, packageStaff, packages, serviceTypes, services, staff, staffServices } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { checkbox, optionalText, trimmed, emptyToUndefined } from "@/lib/validation/common";
import { parseTLToKurus } from "@/lib/money";
import { bizAudit, type Biz } from "./context";

const price = z.preprocess(
  (v) => (typeof v === "string" ? parseTLToKurus(v) : v),
  z.number({ error: "Geçerli bir fiyat girin (örn. 450 veya 449,90)." }).int().min(0, "Fiyat negatif olamaz.").max(10_000_000, "Fiyat çok yüksek."),
);
const duration = z.coerce
  .number({ error: "Süre girin." })
  .int("Süre dakika cinsinden tam sayı olmalı.")
  .min(5, "Süre en az 5 dakika olmalı.")
  .max(600, "Süre en fazla 600 dakika olabilir.")
  .refine((n) => n % 5 === 0, "Süre 5 dakikanın katı olmalı.");
const idList = z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().uuid()).max(100));

export const serviceSchema = z.object({
  name: trimmed(2, 80, "Hizmet adı"),
  description: optionalText(500, "Açıklama"),
  serviceTypeId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  priceKurus: price,
  durationMin: duration,
  isActive: checkbox,
  staffIds: idList,
});

export const packageSchema = z.object({
  name: trimmed(2, 80, "Paket adı"),
  description: optionalText(500, "Açıklama"),
  priceKurus: price,
  durationMin: z.preprocess(emptyToUndefined, duration.optional()),
  isActive: checkbox,
  serviceIds: idList.refine((a) => a.length >= 2, "Paket en az 2 hizmet içermeli."),
  staffIds: idList,
});

/** Pazaryeri filtresi için "en düşük fiyat" önbelleğini günceller. */
export async function recalcMinPrice(db: Executor, businessId: string) {
  await db.execute(sql`
    UPDATE businesses SET min_price_kurus = (
      SELECT min(p) FROM (
        SELECT price_kurus AS p FROM services WHERE business_id = ${businessId} AND is_active AND deleted_at IS NULL
        UNION ALL
        SELECT price_kurus FROM packages WHERE business_id = ${businessId} AND is_active AND deleted_at IS NULL
      ) x)
    WHERE id = ${businessId}`);
}

/** Verilen kimliklerin hepsi bu işletmeye ait ve silinmemiş mi? */
async function assertOwned(db: Executor, table: typeof staff | typeof services, businessId: string, ids: string[], label: string) {
  if (!ids.length) return;
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.businessId, businessId), inArray(table.id, ids), isNull(table.deletedAt)));
  if (rows.length !== new Set(ids).size) throw new AppError("VALIDATION", `Seçilen ${label} bulunamadı.`);
}

/* ───────── Hizmetler ───────── */

export async function listServices(db: Executor, businessId: string) {
  const rows = await db
    .select({ s: services, typeName: serviceTypes.name })
    .from(services)
    .leftJoin(serviceTypes, eq(serviceTypes.id, services.serviceTypeId))
    .where(and(eq(services.businessId, businessId), isNull(services.deletedAt)))
    .orderBy(asc(services.sortOrder), asc(services.name));
  const links = await db.select().from(staffServices).where(eq(staffServices.businessId, businessId));
  return rows.map((r) => ({ ...r.s, typeName: r.typeName, staffIds: links.filter((l) => l.serviceId === r.s.id).map((l) => l.staffId) }));
}

export async function getService(db: Executor, businessId: string, id: string) {
  const all = await listServices(db, businessId);
  const s = all.find((x) => x.id === id);
  if (!s) throw notFound("Hizmet");
  return s;
}

export async function saveService(db: DB, biz: Biz, id: string | null, input: z.infer<typeof serviceSchema>) {
  return db.transaction(async (tx) => {
    await assertOwned(tx, staff, biz.businessId, input.staffIds, "çalışan");
    const values = {
      name: input.name,
      description: input.description ?? null,
      serviceTypeId: input.serviceTypeId ?? null,
      priceKurus: input.priceKurus,
      durationMin: input.durationMin,
      isActive: input.isActive,
    };
    let serviceId = id;
    if (id) {
      const res = await tx
        .update(services)
        .set(values)
        .where(and(eq(services.id, id), eq(services.businessId, biz.businessId), isNull(services.deletedAt)))
        .returning({ id: services.id });
      if (!res.length) throw notFound("Hizmet");
    } else {
      const [row] = await tx.insert(services).values({ ...values, businessId: biz.businessId }).returning({ id: services.id });
      serviceId = row!.id;
    }
    await tx.delete(staffServices).where(and(eq(staffServices.businessId, biz.businessId), eq(staffServices.serviceId, serviceId!)));
    if (input.staffIds.length)
      await tx.insert(staffServices).values(input.staffIds.map((staffId) => ({ businessId: biz.businessId, staffId, serviceId: serviceId! })));
    await recalcMinPrice(tx, biz.businessId);
    await audit(tx, { ...bizAudit(biz), action: id ? "service.update" : "service.create", entity: "service", entityId: serviceId! });
    return serviceId!;
  });
}

/** Hizmet geçmiş randevularda kaldığı için kalıcı silinmez (soft delete). Aktif pakette kullanılıyorsa engellenir. */
export async function deleteService(db: DB, biz: Biz, id: string) {
  await db.transaction(async (tx) => {
    const used = await tx
      .select({ name: packages.name })
      .from(packageItems)
      .innerJoin(packages, eq(packages.id, packageItems.packageId))
      .where(and(eq(packageItems.businessId, biz.businessId), eq(packageItems.serviceId, id), isNull(packages.deletedAt)));
    if (used.length)
      throw new AppError("CONFLICT", `Bu hizmet şu paketlerde kullanılıyor: ${used.map((u) => u.name).join(", ")}. Önce paketlerden çıkarın.`);
    const res = await tx
      .update(services)
      .set({ deletedAt: new Date(), isActive: false })
      .where(and(eq(services.id, id), eq(services.businessId, biz.businessId), isNull(services.deletedAt)))
      .returning({ id: services.id });
    if (!res.length) throw notFound("Hizmet");
    await tx.delete(staffServices).where(and(eq(staffServices.businessId, biz.businessId), eq(staffServices.serviceId, id)));
    await recalcMinPrice(tx, biz.businessId);
    await audit(tx, { ...bizAudit(biz), action: "service.delete", entity: "service", entityId: id });
  });
}

/* ───────── Paketler ───────── */

export async function listPackages(db: Executor, businessId: string) {
  const rows = await db
    .select()
    .from(packages)
    .where(and(eq(packages.businessId, businessId), isNull(packages.deletedAt)))
    .orderBy(asc(packages.sortOrder), asc(packages.name));
  const [items, staffLinks] = [
    await db
      .select({ packageId: packageItems.packageId, serviceId: packageItems.serviceId, name: services.name, durationMin: services.durationMin, sortOrder: packageItems.sortOrder })
      .from(packageItems)
      .innerJoin(services, eq(services.id, packageItems.serviceId))
      .where(eq(packageItems.businessId, businessId))
      .orderBy(asc(packageItems.sortOrder)),
    await db.select().from(packageStaff).where(eq(packageStaff.businessId, businessId)),
  ];
  return rows.map((p) => ({
    ...p,
    items: items.filter((i) => i.packageId === p.id),
    staffIds: staffLinks.filter((l) => l.packageId === p.id).map((l) => l.staffId),
  }));
}

export async function getPackage(db: Executor, businessId: string, id: string) {
  const p = (await listPackages(db, businessId)).find((x) => x.id === id);
  if (!p) throw notFound("Paket");
  return p;
}

/**
 * Paket kaydı. Paketin tamamını tek çalışan yapar: seçilen her çalışan, paketteki TÜM hizmetlere yetkin olmalıdır.
 * Süre boş bırakılırsa hizmet sürelerinin toplamı kullanılır.
 */
export async function savePackage(db: DB, biz: Biz, id: string | null, input: z.infer<typeof packageSchema>) {
  return db.transaction(async (tx) => {
    await assertOwned(tx, services, biz.businessId, input.serviceIds, "hizmet");
    await assertOwned(tx, staff, biz.businessId, input.staffIds, "çalışan");
    const svc = await tx.select().from(services).where(and(eq(services.businessId, biz.businessId), inArray(services.id, input.serviceIds)));
    if (input.staffIds.length) {
      const links = await tx
        .select()
        .from(staffServices)
        .where(and(eq(staffServices.businessId, biz.businessId), inArray(staffServices.staffId, input.staffIds), inArray(staffServices.serviceId, input.serviceIds)));
      const staffRows = await tx.select({ id: staff.id, name: staff.name }).from(staff).where(inArray(staff.id, input.staffIds));
      const missing = staffRows.filter((st) => input.serviceIds.some((sid) => !links.some((l) => l.staffId === st.id && l.serviceId === sid)));
      if (missing.length)
        throw new AppError(
          "VALIDATION",
          `${missing.map((m) => m.name).join(", ")} paketteki hizmetlerin hepsini veremiyor. Önce çalışanın hizmetlerini güncelleyin ya da çalışanı paketten çıkarın.`,
          { staffIds: "Seçilen çalışanlar paketteki tüm hizmetlere yetkin olmalı." },
        );
    }
    const durationMin = input.durationMin ?? svc.reduce((a, s) => a + s.durationMin, 0);
    if (durationMin > 600) throw new AppError("VALIDATION", "Paket süresi en fazla 600 dakika olabilir.", { durationMin: "En fazla 600 dakika." });
    const values = { name: input.name, description: input.description ?? null, priceKurus: input.priceKurus, durationMin, isActive: input.isActive };
    let packageId = id;
    if (id) {
      const res = await tx
        .update(packages)
        .set(values)
        .where(and(eq(packages.id, id), eq(packages.businessId, biz.businessId), isNull(packages.deletedAt)))
        .returning({ id: packages.id });
      if (!res.length) throw notFound("Paket");
    } else {
      const [row] = await tx.insert(packages).values({ ...values, businessId: biz.businessId }).returning({ id: packages.id });
      packageId = row!.id;
    }
    await tx.delete(packageItems).where(and(eq(packageItems.businessId, biz.businessId), eq(packageItems.packageId, packageId!)));
    await tx.insert(packageItems).values(input.serviceIds.map((serviceId, i) => ({ businessId: biz.businessId, packageId: packageId!, serviceId, sortOrder: i })));
    await tx.delete(packageStaff).where(and(eq(packageStaff.businessId, biz.businessId), eq(packageStaff.packageId, packageId!)));
    if (input.staffIds.length)
      await tx.insert(packageStaff).values(input.staffIds.map((staffId) => ({ businessId: biz.businessId, packageId: packageId!, staffId })));
    await recalcMinPrice(tx, biz.businessId);
    await audit(tx, { ...bizAudit(biz), action: id ? "package.update" : "package.create", entity: "package", entityId: packageId! });
    return packageId!;
  });
}

export async function deletePackage(db: DB, biz: Biz, id: string) {
  await db.transaction(async (tx) => {
    const res = await tx
      .update(packages)
      .set({ deletedAt: new Date(), isActive: false })
      .where(and(eq(packages.id, id), eq(packages.businessId, biz.businessId), isNull(packages.deletedAt)))
      .returning({ id: packages.id });
    if (!res.length) throw notFound("Paket");
    await tx.delete(packageStaff).where(and(eq(packageStaff.businessId, biz.businessId), eq(packageStaff.packageId, id)));
    await recalcMinPrice(tx, biz.businessId);
    await audit(tx, { ...bizAudit(biz), action: "package.delete", entity: "package", entityId: id });
  });
}

export function listActiveServiceTypes(db: Executor) {
  return db.select({ id: serviceTypes.id, name: serviceTypes.name }).from(serviceTypes).where(eq(serviceTypes.isActive, true)).orderBy(asc(serviceTypes.sortOrder));
}

