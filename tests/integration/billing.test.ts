import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { businessSubscriptions, subscriptionPlans } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { setSetting } from "@/server/modules/platform/settings";
import {
  createPlan,
  disableBilling,
  enableBilling,
  getBusinessSubscription,
  recordPayment,
  setDefaultPlan,
  updateBusinessSubscription,
} from "@/server/modules/billing/subscriptions";
import { addDaysStr, periodEnd, todayTR } from "@/lib/dates";
import { setBillingCycle } from "@/server/modules/business/billing";
import { currentFee } from "@/server/modules/billing/status";
import { makeAdmin, makeBusiness, uid } from "../helpers/factory";

const sub = async (businessId: string) => (await db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, businessId)))[0]!;

beforeEach(async () => {
  await setSetting(db, "billing.status", { enabled: false, liveSince: null });
});

describe("kampanya: ilk N işletme", () => {
  it("eşzamanlı oluşturmada kampanya sınırı aşılmaz", async () => {
    const admin = await makeAdmin();
    const [{ used }] = (await db.execute(sql`select count(*)::int as used from business_subscriptions where is_early_adopter`)).rows as [{ used: number }];
    await setSetting(db, "billing.earlyAdopter", { limit: used + 2, trialMonths: 3 });
    await setSetting(db, "billing.defaultTrialMonths", 1);
    const created = await Promise.all(Array.from({ length: 5 }, () => makeBusiness(admin.id)));
    const subs = await Promise.all(created.map((c) => sub(c.businessId)));
    expect(subs.filter((s) => s.isEarlyAdopter)).toHaveLength(2);
    expect(subs.filter((s) => s.isEarlyAdopter).every((s) => s.trialMonths === 3)).toBe(true);
    expect(subs.filter((s) => !s.isEarlyAdopter).every((s) => s.trialMonths === 1)).toBe(true);
    // Fiyat paketten kilitlenir
    expect(subs.every((s) => s.monthlyFeeKurus === 34990 && s.yearlyFeeKurus === 349000)).toBe(true);
  });

  it("ücretlendirme kapalıyken deneme süresi başlamaz; açılınca bugün başlar", async () => {
    const admin = await makeAdmin();
    const b = await makeBusiness(admin.id);
    const before = await sub(b.businessId);
    expect(before.trialStartsOn).toBeNull();
    expect((await getBusinessSubscription(db, b.businessId))!.status.kind).toBe("FREE_PERIOD");

    await enableBilling(db, { adminId: admin.id });
    const after = await sub(b.businessId);
    const today = todayTR();
    expect(after.trialStartsOn).toBe(today);
    expect(after.trialEndsOn).toBe(periodEnd(today, after.trialMonths));
    expect((await getBusinessSubscription(db, b.businessId))!.status.kind).toBe("TRIAL");

    // Ücretlendirme açıkken eklenen işletmenin denemesi hemen başlar
    const b2 = await makeBusiness(admin.id);
    expect((await sub(b2.businessId)).trialStartsOn).toBe(today);

    await disableBilling(db, { adminId: admin.id });
    expect((await getBusinessSubscription(db, b.businessId))!.status.kind).toBe("FREE_PERIOD");
    expect((await sub(b.businessId)).trialEndsOn).toBe(after.trialEndsOn); // tarihler korunur
  });
});

describe("ödeme kaydı", () => {
  it("ücretlendirme kapalıyken ödeme kaydedilemez", async () => {
    const admin = await makeAdmin();
    const b = await makeBusiness(admin.id);
    await expect(
      recordPayment(db, { adminId: admin.id }, b.businessId, { months: 1, amount: "900", method: "BANK_TRANSFER", paidOn: todayTR() }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("dönemler deneme sonundan itibaren ardışık uzar; gecikmiş işletme ödemeyle düzelir", async () => {
    const admin = await makeAdmin();
    const b = await makeBusiness(admin.id);
    await enableBilling(db, { adminId: admin.id });
    // Denemeyi geçmişe çek: gecikmiş duruma düşür
    const trialEnd = addDaysStr(todayTR(), -10);
    await db.update(businessSubscriptions).set({ trialEndsOn: trialEnd }).where(eq(businessSubscriptions.businessId, b.businessId));
    expect((await getBusinessSubscription(db, b.businessId))!.status).toMatchObject({ kind: "PAST_DUE", days: 10 });

    const p1 = await recordPayment(db, { adminId: admin.id }, b.businessId, { months: 1, amount: "900", method: "BANK_TRANSFER", paidOn: todayTR() });
    expect(p1.coversFrom).toBe(addDaysStr(trialEnd, 1));
    expect(p1.coversTo).toBe(periodEnd(p1.coversFrom, 1));
    const p2 = await recordPayment(db, { adminId: admin.id }, b.businessId, { months: 2, amount: "1.800", method: "CARD", paidOn: todayTR() });
    expect(p2.coversFrom).toBe(addDaysStr(p1.coversTo, 1));
    expect(p2.amountKurus).toBe(180000);
    const s = await getBusinessSubscription(db, b.businessId);
    expect(s!.sub.paidThrough).toBe(p2.coversTo);
    expect(s!.status.kind).toBe("PAID");
  });
});

describe("paketler", () => {
  it("yeni paket eklenir, varsayılan değiştirilir; işletme pakete özel ücretle geçirilebilir", async () => {
    const admin = await makeAdmin();
    const code = `premium-${uid()}`;
    const premium = await createPlan(db, { adminId: admin.id }, {
      name: "Premium Plus",
      code,
      description: "Öne çıkan listeleme",
      monthlyPriceKurus: 150000,
      yearlyPriceKurus: null, lifetimePriceKurus: null,
      highlights: ["Öne çıkan"],
      isActive: true,
      sortOrder: 1,
    });
    await expect(
      createPlan(db, { adminId: admin.id }, { name: "X", code, description: undefined, monthlyPriceKurus: 1, yearlyPriceKurus: null, lifetimePriceKurus: null, highlights: [], isActive: true, sortOrder: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const b = await makeBusiness(admin.id);
    await updateBusinessSubscription(db, { adminId: admin.id }, b.businessId, { planId: premium!.id, trialMonths: 2, customFee: "1.200" });
    const s = await sub(b.businessId);
    expect(s.planId).toBe(premium!.id);
    expect(s.monthlyFeeKurus).toBe(120000);
    expect(s.trialMonths).toBe(2);

    // Varsayılanı değiştir → yeni işletmeler Premium ile başlar; sonra geri al
    const [standart] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, "standart"));
    await setDefaultPlan(db, { adminId: admin.id }, premium!.id);
    const b2 = await makeBusiness(admin.id);
    expect((await sub(b2.businessId)).planId).toBe(premium!.id);
    await setDefaultPlan(db, { adminId: admin.id }, standart!.id);
    const defaults = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isDefault, true));
    expect(defaults).toHaveLength(1);
  });
});

describe("aylık / yıllık dönem", () => {
  it("işletme yıllığa geçer; yıllık ödeme 12 ay kapsar; yıllık seçeneği olmayan pakette reddedilir", async () => {
    const admin = await makeAdmin();
    const b = await makeBusiness(admin.id);
    const biz = { businessId: b.businessId, userId: b.userId };
    expect(currentFee(await sub(b.businessId))).toMatchObject({ kurus: 34990, months: 1 });

    await setBillingCycle(db, biz, "YEARLY");
    const s1 = await sub(b.businessId);
    expect(s1.billingCycle).toBe("YEARLY");
    expect(currentFee(s1)).toMatchObject({ kurus: 349000, months: 12, unit: "yıl" });

    await enableBilling(db, { adminId: admin.id });
    const p = await recordPayment(db, { adminId: admin.id }, b.businessId, { months: 12, amount: "3.490", method: "BANK_TRANSFER", paidOn: todayTR() });
    expect(p.amountKurus).toBe(349000);
    expect(p.coversTo).toBe(periodEnd(p.coversFrom, 12));

    // Yıllık fiyatı olmayan pakete geçince dönem aylığa döner ve yıllık seçilemez
    const monthlyOnly = await createPlan(db, { adminId: admin.id }, {
      name: "Sadece aylık",
      code: `aylik-${uid()}`,
      monthlyPriceKurus: 50000,
      yearlyPriceKurus: null, lifetimePriceKurus: null,
      highlights: [],
      isActive: true,
      sortOrder: 9,
    });
    await updateBusinessSubscription(db, { adminId: admin.id }, b.businessId, { planId: monthlyOnly!.id, trialMonths: 1 });
    const s2 = await sub(b.businessId);
    expect(s2).toMatchObject({ billingCycle: "MONTHLY", yearlyFeeKurus: null, monthlyFeeKurus: 50000 });
    await expect(setBillingCycle(db, biz, "YEARLY")).rejects.toMatchObject({ code: "VALIDATION" });

    // Veritabanı da yıllık ücretsiz yıllık dönemi kabul etmez
    await expect(
      db.update(businessSubscriptions).set({ billingCycle: "YEARLY" }).where(eq(businessSubscriptions.businessId, b.businessId)),
    ).rejects.toThrow();
  });
});

describe("tek seferlik ödeme", () => {
  it("işletme tek seferliği seçer; ödeme süresiz kapsar; sonrasında dönem değişmez ve yeni ödeme alınmaz", async () => {
    const admin = await makeAdmin();
    const b = await makeBusiness(admin.id);
    const biz = { businessId: b.businessId, userId: b.userId };
    expect((await sub(b.businessId)).lifetimeFeeKurus).toBe(1499900);

    await setBillingCycle(db, biz, "LIFETIME");
    const s1 = await sub(b.businessId);
    expect(currentFee(s1)).toMatchObject({ kurus: 1499900, months: 0, label: "Tek seferlik" });

    await enableBilling(db, { adminId: admin.id });
    const p = await recordPayment(db, { adminId: admin.id }, b.businessId, { months: 1, amount: "14.999", method: "BANK_TRANSFER", paidOn: todayTR() });
    expect(p).toMatchObject({ amountKurus: 1499900, months: 0, coversTo: "2099-12-31" });
    const st = (await getBusinessSubscription(db, b.businessId))!.status;
    expect(st).toMatchObject({ kind: "PAID", lifetime: true });

    await expect(setBillingCycle(db, biz, "MONTHLY")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      recordPayment(db, { adminId: admin.id }, b.businessId, { months: 1, amount: "349,90", method: "BANK_TRANSFER", paidOn: todayTR() }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await disableBilling(db, { adminId: admin.id });
  });

  it("tek seferlik fiyatı olmayan pakette seçilemez; admin dönemi değiştirebilir", async () => {
    const admin = await makeAdmin();
    const b = await makeBusiness(admin.id);
    const biz = { businessId: b.businessId, userId: b.userId };
    const [standart] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, "standart"));
    await updateBusinessSubscription(db, { adminId: admin.id }, b.businessId, { planId: standart!.id, trialMonths: 1, billingCycle: "LIFETIME", customLifetimeFee: "12.000" });
    expect(await sub(b.businessId)).toMatchObject({ billingCycle: "LIFETIME", lifetimeFeeKurus: 1200000 });

    const noLifetime = await createPlan(db, { adminId: admin.id }, {
      name: "Tek seferliksiz",
      code: `tsz-${uid()}`,
      monthlyPriceKurus: 50000,
      yearlyPriceKurus: null,
      lifetimePriceKurus: null,
      highlights: [],
      isActive: true,
      sortOrder: 9,
    });
    await updateBusinessSubscription(db, { adminId: admin.id }, b.businessId, { planId: noLifetime!.id, trialMonths: 1 });
    expect(await sub(b.businessId)).toMatchObject({ billingCycle: "MONTHLY", lifetimeFeeKurus: null });
    await expect(setBillingCycle(db, biz, "LIFETIME")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      updateBusinessSubscription(db, { adminId: admin.id }, b.businessId, { planId: noLifetime!.id, trialMonths: 1, billingCycle: "LIFETIME" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
