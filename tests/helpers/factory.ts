import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { businessCustomers, businesses, businessSettings, districts, platformAdmins, staff } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { createBusiness } from "@/server/modules/admin/businesses";

export const uid = () => randomUUID().slice(0, 8);

export async function anyDistrict() {
  const [d] = await db.select().from(districts).where(eq(districts.provinceId, 34)).limit(1);
  return d!;
}

export async function makeAdmin(password = "AdminSifre2026") {
  const [a] = await db
    .insert(platformAdmins)
    .values({ email: `admin-${uid()}@test.local`, name: "Test Admin", passwordHash: await hashPassword(password) })
    .returning();
  return { ...a!, password };
}

/** Admin akışıyla işletme + hesap oluşturur. */
export async function makeBusiness(adminId: string, overrides: Partial<{ name: string; slug: string; login: string }> = {}) {
  const d = await anyDistrict();
  const r = await createBusiness(db, { adminId }, {
    name: overrides.name ?? `Test Berber ${uid()}`,
    slug: overrides.slug,
    phone: "+905321234567",
    addressLine: "Test Mah. Deneme Sok. No:1",
    provinceId: d.provinceId,
    districtId: d.id,
    ownerName: "İşletme Sahibi",
    login: overrides.login ?? `isletme-${uid()}`,
  });
  return r!;
}

/** Doğrudan DB'ye minimal işletme (kısıt testleri için). */
export async function rawBusiness() {
  const d = await anyDistrict();
  const [b] = await db
    .insert(businesses)
    .values({ slug: `raw-${uid()}`, name: "Raw", phone: "+905321234567", addressLine: "Adres 12345", provinceId: d.provinceId, districtId: d.id })
    .returning();
  await db.insert(businessSettings).values({ businessId: b!.id });
  return b!;
}

export async function rawStaff(businessId: string, name = "Usta") {
  const [s] = await db.insert(staff).values({ businessId, name }).returning();
  return s!;
}

export async function rawBusinessCustomer(businessId: string) {
  const [c] = await db.insert(businessCustomers).values({ businessId, displayName: "Kapıdan Müşteri", phone: "+905551112233" }).returning();
  return c!;
}

export async function clearRateLimits() {
  await db.execute(sql`DELETE FROM rate_limits`);
}
