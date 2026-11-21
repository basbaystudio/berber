import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { businessSubscriptions, businesses, notifications, subscriptionPayments } from "@/server/db/schema";
import { setSetting } from "@/server/modules/platform/settings";
import { enableBilling, recordPayment } from "@/server/modules/billing/subscriptions";
import { runBillingEnforcement } from "@/server/modules/billing/enforcement";
import { handleGatewayEvent } from "@/server/modules/billing/gateway";
import { setBusinessStatus } from "@/server/modules/admin/businesses";
import { login } from "@/server/auth/login";
import { validateSession } from "@/server/auth/session";
import { AppError } from "@/server/lib/errors";
import { addDaysStr, todayTR } from "@/lib/dates";
import { clearRateLimits, makeAdmin, makeBusiness } from "../helpers/factory";

const meta = { ip: "10.0.0.9", userAgent: "vitest" };
let adminId = "";

beforeAll(async () => {
  adminId = (await makeAdmin()).id;
  await setSetting(db, "platform.contact", { email: "destek@test.local", phone: "0850 000 00 00", alertEmail: "ops@test.local" });
  await setSetting(db, "billing.graceDays", 7);
  await enableBilling(db, { adminId });
});

/** Yayında, aktif bir işletme ve ödeme gecikmesini `days` gün olarak ayarla. */
async function liveBusinessPastDue(days: number) {
  const b = await makeBusiness(adminId);
  await db.update(businesses).set({ status: "ACTIVE" }).where(eq(businesses.id, b.businessId));
  await db.update(businesses).set({ isPublished: true, publishedAt: new Date() }).where(eq(businesses.id, b.businessId));
  const trialEnd = addDaysStr(todayTR(), -days);
  await db
    .update(businessSubscriptions)
    .set({ trialStartsOn: addDaysStr(trialEnd, -30), trialEndsOn: trialEnd })
    .where(eq(businessSubscriptions.businessId, b.businessId));
  return { ...b, trialEnd };
}

const mails = (businessId: string, template: string) =>
  db.select().from(notifications).where(and(eq(notifications.businessId, businessId), like(notifications.template, `${template}%`)));

describe("ödeme gecikmesi", () => {
  it("ilk gün işletmeye ve yöneticiye bir kez e-posta gider, işletme açık kalır", async () => {
    const b = await liveBusinessPastDue(1);
    await runBillingEnforcement(db);
    const sent = await mails(b.businessId, "billing.past_due");
    expect(sent.map((m) => m.to).sort()).toEqual(["ops@test.local", expect.stringMatching(/@test\.local$/)].sort());
    expect(sent).toHaveLength(2);
    expect(sent.every((m) => m.status === "SENT")).toBe(true);
    expect((sent.find((m) => m.template.endsWith("business"))!.payload as { text: string }).text).toContain("destek@test.local");
    // Tekrar çalıştırma yeni e-posta üretmez
    await runBillingEnforcement(db);
    expect(await mails(b.businessId, "billing.past_due")).toHaveLength(2);
    const [row] = await db.select().from(businesses).where(eq(businesses.id, b.businessId));
    expect(row).toMatchObject({ status: "ACTIVE", isPublished: true });
  });

  it("henüz gecikmemiş işletmeye e-posta gitmez", async () => {
    const b = await liveBusinessPastDue(0);
    await runBillingEnforcement(db);
    expect(await mails(b.businessId, "billing")).toHaveLength(0);
  });

  it("7. günde otomatik askıya alınır; oturumlar kapanır; giriş mesajı nedeni söyler", async () => {
    const b = await liveBusinessPastDue(7);
    await clearRateLimits();
    const { token } = await login(db, "BUSINESS", b.login, b.tempPassword, meta);
    await runBillingEnforcement(db);
    const [row] = await db.select().from(businesses).where(eq(businesses.id, b.businessId));
    expect(row).toMatchObject({ status: "SUSPENDED", suspendedReason: "BILLING", isPublished: false, republishOnReactivate: true });
    expect(await validateSession(db, "BUSINESS", token)).toBeNull();
    expect(await mails(b.businessId, "billing.suspended")).toHaveLength(2);
    const err = await login(db, "BUSINESS", b.login, b.tempPassword, meta).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).message).toContain("ödeme");
  });

  it("ödeme kaydedilince otomatik açılır ve yeniden yayına alınır", async () => {
    const b = await liveBusinessPastDue(9);
    await runBillingEnforcement(db);
    expect((await db.select().from(businesses).where(eq(businesses.id, b.businessId)))[0]!.status).toBe("SUSPENDED");
    await recordPayment(db, { adminId }, b.businessId, { months: 1, amount: "900", method: "BANK_TRANSFER", paidOn: todayTR() });
    const [row] = await db.select().from(businesses).where(eq(businesses.id, b.businessId));
    expect(row).toMatchObject({ status: "ACTIVE", suspendedReason: null, isPublished: true, republishOnReactivate: false });
  });

  it("yöneticinin elle askıya aldığı işletme ödemeyle açılmaz", async () => {
    const b = await liveBusinessPastDue(2);
    await setBusinessStatus(db, { adminId }, b.businessId, "SUSPENDED");
    await recordPayment(db, { adminId }, b.businessId, { months: 1, amount: "900", method: "CASH", paidOn: todayTR() });
    const [row] = await db.select().from(businesses).where(eq(businesses.id, b.businessId));
    expect(row).toMatchObject({ status: "SUSPENDED", suspendedReason: "ADMIN" });
  });

  it("ücretlendirme kapalıyken hiçbir işlem yapılmaz", async () => {
    await setSetting(db, "billing.status", { enabled: false, liveSince: todayTR() });
    const b = await liveBusinessPastDue(30);
    const r = await runBillingEnforcement(db);
    expect(r.skipped).toBe(true);
    expect((await db.select().from(businesses).where(eq(businesses.id, b.businessId)))[0]!.status).toBe("ACTIVE");
    await setSetting(db, "billing.status", { enabled: true, liveSince: todayTR() });
  });
});

describe("otomatik kart aboneliği (ödeme sağlayıcısı olayları)", () => {
  it("başarılı çekim ödeme olarak kaydedilir; aynı olay tekrar gelirse çift kayıt olmaz", async () => {
    const b = await liveBusinessPastDue(3);
    await handleGatewayEvent(db, "test-pay", { type: "SUBSCRIPTION_ACTIVATED", businessId: b.businessId, customerRef: "cus_1", subscriptionRef: `sub_${b.businessId}`, cardBrand: "VISA", cardLast4: "4242" });
    const ev = { type: "CHARGE_SUCCEEDED" as const, subscriptionRef: `sub_${b.businessId}`, chargeRef: `ch_${b.businessId}`, amountKurus: 90000, months: 1, paidAt: new Date() };
    await handleGatewayEvent(db, "test-pay", ev);
    await handleGatewayEvent(db, "test-pay", ev);
    const pays = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.businessId, b.businessId));
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ method: "CARD", provider: "test-pay", amountKurus: 90000 });
    const [sub] = await db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, b.businessId));
    expect(sub).toMatchObject({ autoRenew: true, cardLast4: "4242", paidThrough: pays[0]!.coversTo });
    // Kart numarasının tamamı hiçbir yerde saklanmaz
    expect(JSON.stringify(sub)).not.toMatch(/\d{12,}/);
  });

  it("geçersiz kart son 4 hanesi veritabanında reddedilir", async () => {
    const b = await makeBusiness(adminId);
    await expect(db.update(businessSubscriptions).set({ cardLast4: "4242424242424242" }).where(eq(businessSubscriptions.businessId, b.businessId))).rejects.toThrow();
  });
});
