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
    expect(subs.every((s) => s.monthlyFeeKurus === 90000)).toBe(true);
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
      highlights: ["Öne çıkan"],
      isActive: true,
      sortOrder: 1,
    });
    await expect(
      createPlan(db, { adminId: admin.id }, { name: "X", code, description: undefined, monthlyPriceKurus: 1, highlights: [], isActive: true, sortOrder: 0 }),
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
