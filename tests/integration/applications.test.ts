import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { businessApplications, businessSubscriptions, businessUsers, districts, notifications, subscriptionPlans } from "@/server/db/schema";
import { setSetting } from "@/server/modules/platform/settings";
import { applicationSchema, approveApplication, getApplicationOffer, rejectApplication, submitApplication } from "@/server/modules/applications";
import { createPlan } from "@/server/modules/billing/subscriptions";
import { makeAdmin, uid } from "../helpers/factory";

const code = (p: Promise<unknown>) => p.then(() => "OK", (e) => (e as { code?: string }).code);
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function kadikoy() {
  const [d] = await db.select().from(districts).where(and(eq(districts.provinceId, 34), eq(districts.slug, "kadikoy")));
  return d!;
}
async function defaultPlan() {
  return (await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, "standart")))[0]!;
}
async function input(over: Record<string, unknown> = {}) {
  const d = await kadikoy();
  const plan = await defaultPlan();
  const n = Math.floor(1000000 + Math.random() * 8999999);
  return applicationSchema.parse({
    businessName: `Başvuru Berber ${uid()}`,
    ownerName: "Ali Usta",
    phone: `0532${n}`,
    email: `basvuru-${uid()}@test.local`,
    provinceId: "34",
    districtId: String(d.id),
    addressLine: "Moda Cad. No:5",
    staffCount: "2",
    planId: plan.id,
    billingCycle: "YEARLY",
    kvkk: "on",
    website: "",
    ...over,
  });
}

describe("işletme başvurusu", () => {
  it("form doğrulaması: KVKK onayı ve bot tuzağı", async () => {
    const base = await input();
    expect(applicationSchema.safeParse({ ...base, kvkk: undefined, staffCount: "2", provinceId: "34", districtId: String(base.districtId) }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...base, kvkk: "on", website: "http://spam", staffCount: "2", provinceId: "34", districtId: String(base.districtId) }).success).toBe(false);
  });

  it("başvuru kaydedilir, yöneticiye ve başvurana e-posta gider; bekleyen aynı başvuru tekrarlanamaz; il/ilçe ve paket doğrulanır", async () => {
    await makeAdmin();
    const i = await input();
    const app = await submitApplication(db, i, { ip: ip() });
    expect(app.status).toBe("NEW");
    const mails = await db.select().from(notifications).where(sql`${notifications.dedupeKey} like ${`application.%${app.id}%`}`);
    expect(mails.map((m) => m.template)).toEqual(expect.arrayContaining(["application.new.admin", "application.received"]));
    expect(await code(submitApplication(db, { ...i, businessName: "Başka" }, { ip: ip() }))).toBe("CONFLICT");

    const wrongDistrict = await input({ provinceId: "6" }); // Ankara + Kadıköy
    expect(await code(submitApplication(db, wrongDistrict, { ip: ip() }))).toBe("VALIDATION");

    const admin = await makeAdmin();
    const monthlyOnly = await createPlan(db, { adminId: admin.id }, { name: "Aylık paket", code: `ay-${uid()}`, monthlyPriceKurus: 50000, yearlyPriceKurus: null, lifetimePriceKurus: null, highlights: [], isActive: true, sortOrder: 99 });
    expect(await code(submitApplication(db, await input({ planId: monthlyOnly!.id, billingCycle: "YEARLY" }), { ip: ip() }))).toBe("VALIDATION");
    await db.update(subscriptionPlans).set({ isActive: false }).where(eq(subscriptionPlans.id, monthlyOnly!.id));
  });

  it("aynı IP'den saatte en fazla 3 başvuru", async () => {
    const same = ip();
    for (let k = 0; k < 3; k++) await submitApplication(db, await input(), { ip: same });
    expect(await code(submitApplication(db, await input(), { ip: same }))).toBe("RATE_LIMITED");
  });

  it("onay: işletme oluşur, seçilen paket ve dönem işlenir; ücretsiz süre onay sırasına göre (kampanya dolunca standart)", async () => {
    const admin = await makeAdmin();
    const actor = { adminId: admin.id };
    const [{ used }] = (await db.execute(sql`select count(*)::int as used from business_subscriptions where is_early_adopter`)).rows as [{ used: number }];
    await setSetting(db, "billing.earlyAdopter", { limit: used + 1, trialMonths: 3 });
    await setSetting(db, "billing.defaultTrialMonths", 1);
    const offer = await getApplicationOffer(db);
    expect(offer.early.remaining).toBe(1);
    expect(offer.currentFreeMonths).toBe(3);

    const a1 = await submitApplication(db, await input(), { ip: ip() });
    const a2 = await submitApplication(db, await input({ billingCycle: "MONTHLY" }), { ip: ip() });
    const r1 = await approveApplication(db, actor, a1.id);
    const r2 = await approveApplication(db, actor, a2.id);
    expect([r1.trialMonths, r1.isEarlyAdopter]).toEqual([3, true]);
    expect([r2.trialMonths, r2.isEarlyAdopter]).toEqual([1, false]);
    expect((await getApplicationOffer(db)).currentFreeMonths).toBe(1);

    const [s1] = await db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, r1.businessId));
    expect(s1).toMatchObject({ billingCycle: "YEARLY", yearlyFeeKurus: 699000, monthlyFeeKurus: 69990 });
    const [s2] = await db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, r2.businessId));
    expect(s2!.billingCycle).toBe("MONTHLY");

    // Tek seferlik seçen başvuru onaylanınca abonelik tek seferlik açılır
    const a3 = await submitApplication(db, await input({ billingCycle: "LIFETIME" }), { ip: ip() });
    const r3 = await approveApplication(db, actor, a3.id);
    const [s3] = await db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, r3.businessId));
    expect(s3).toMatchObject({ billingCycle: "LIFETIME", lifetimeFeeKurus: 1499900 });

    const [u] = await db.select().from(businessUsers).where(eq(businessUsers.businessId, r1.businessId));
    expect(u).toMatchObject({ login: r1.login, mustChangePassword: true });
    const [app1] = await db.select().from(businessApplications).where(eq(businessApplications.id, a1.id));
    expect(app1).toMatchObject({ status: "APPROVED", businessId: r1.businessId });
    const [mail] = await db.select().from(notifications).where(eq(notifications.dedupeKey, `application.approved:${a1.id}`));
    expect(mail?.payload).toBeTruthy();

    // İkinci kez sonuçlandırılamaz
    expect(await code(approveApplication(db, actor, a1.id))).toBe("CONFLICT");
    expect(await code(rejectApplication(db, actor, a1.id))).toBe("CONFLICT");
    await setSetting(db, "billing.earlyAdopter", { limit: 20, trialMonths: 3 });
  });

  it("red: durum güncellenir ve başvurana açıklamayla e-posta gider", async () => {
    const admin = await makeAdmin();
    const a = await submitApplication(db, await input(), { ip: ip() });
    await rejectApplication(db, { adminId: admin.id }, a.id, "Bölgede henüz hizmet vermiyoruz");
    const [row] = await db.select().from(businessApplications).where(eq(businessApplications.id, a.id));
    expect(row).toMatchObject({ status: "REJECTED", rejectReason: "Bölgede henüz hizmet vermiyoruz" });
    expect((await db.select().from(notifications).where(eq(notifications.dedupeKey, `application.rejected:${a.id}`))).length).toBe(1);
  });
});
