import { beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/server/db/client";
import { appointments, businessCustomers, businesses, customers, notifications, reviews, sessions } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { hashPassword } from "@/server/auth/password";
import { login } from "@/server/auth/login";
import { validateSession } from "@/server/auth/session";
import { registerCustomer, requestPasswordReset, resetPassword, verifyEmail, deleteCustomerAccount } from "@/server/modules/customer/auth";
import { searchBusinesses } from "@/server/modules/marketplace/search";
import { getPublicProfile } from "@/server/modules/marketplace/profile";
import { awardMonth, createReview, monthlyRanking, recalcRating, reportReview, resolveReport } from "@/server/modules/reviews/reviews";
import { setSetting } from "@/server/modules/platform/settings";
import { clearRateLimits, makeAdmin, makeBusiness, rawStaff, uid } from "../helpers/factory";

const meta = { ip: "10.1.1.1", userAgent: "vitest" };
const code = (p: Promise<unknown>) => p.then(() => "OK", (e) => (e instanceof AppError ? e.code : String(e)));
const lastLinkToken = async (to: string, template: string) => {
  const [n] = await db.select().from(notifications).where(and(eq(notifications.to, to), eq(notifications.template, template))).orderBy(desc(notifications.createdAt)).limit(1);
  return (n!.payload as { text: string }).text.match(/token=([A-Za-z0-9_-]+)/)![1]!;
};
let adminId = "";
beforeAll(async () => {
  adminId = (await makeAdmin()).id;
  await clearRateLimits();
});

describe("müşteri hesabı", () => {
  it("kayıt → doğrulama e-postası → doğrulama; aynı e-posta ikinci kez kaydolamaz", async () => {
    const email = `kayit-${uid()}@test.local`;
    const input = { name: "Ayşe Yılmaz", email, phone: "+905321112233", password: "Musteri2026x", passwordConfirm: "Musteri2026x", kvkk: "on" as const, marketing: false };
    const { customer, token } = await registerCustomer(db, input, meta);
    expect(customer.emailVerifiedAt).toBeNull();
    expect(await validateSession(db, "CUSTOMER", token)).not.toBeNull();
    expect(await code(registerCustomer(db, input, meta))).toBe("CONFLICT");
    const t = await lastLinkToken(email, "customer.verify_email");
    await verifyEmail(db, t);
    const [c] = await db.select().from(customers).where(eq(customers.id, customer.id));
    expect(c!.emailVerifiedAt).not.toBeNull();
    // Token tek kullanımlık
    expect(await code(verifyEmail(db, t))).toBe("VALIDATION");
    expect(await code(verifyEmail(db, "uydurma-token-1234567890"))).toBe("VALIDATION");
  });

  it("şifre sıfırlama: hesap olmasa da aynı yanıt; token ile şifre değişir, eski oturumlar kapanır", async () => {
    await clearRateLimits();
    await requestPasswordReset(db, "olmayan@test.local", meta.ip); // hata vermez
    const email = `reset-${uid()}@test.local`;
    const { customer, token } = await registerCustomer(db, { name: "Ali Veli", email, phone: "+905321112233", password: "Musteri2026x", passwordConfirm: "Musteri2026x", kvkk: "on", marketing: false }, meta);
    await requestPasswordReset(db, email.toUpperCase(), meta.ip);
    await resetPassword(db, await lastLinkToken(email, "customer.password_reset"), "YeniSifre2026x");
    expect(await validateSession(db, "CUSTOMER", token)).toBeNull();
    await clearRateLimits();
    expect(await code(login(db, "CUSTOMER", email, "Musteri2026x", meta))).toBe("INVALID_CREDENTIALS");
    await login(db, "CUSTOMER", email, "YeniSifre2026x", meta);
    void customer;
  });

  it("hesap silme: şifre doğrulaması; silinince kişisel veriler anonimleşir ve oturumlar kapanır", async () => {
    await clearRateLimits();
    const email = `sil-${uid()}@test.local`;
    const { customer } = await registerCustomer(db, { name: "Silinecek Kişi", email, phone: "+905321112233", password: "Musteri2026x", passwordConfirm: "Musteri2026x", kvkk: "on", marketing: true }, meta);
    expect(await code(deleteCustomerAccount(db, customer.id, "yanlis"))).toBe("VALIDATION");
    await deleteCustomerAccount(db, customer.id, "Musteri2026x");
    const [c] = await db.select().from(customers).where(eq(customers.id, customer.id));
    expect(c).toMatchObject({ name: "Silinmiş kullanıcı", marketingConsent: false });
    expect(c!.email).not.toContain("sil-");
    expect(await db.select().from(sessions).where(eq(sessions.principalId, customer.id))).toHaveLength(0);
  });
});

describe("pazaryeri", () => {
  it("yalnızca aktif ve yayındaki işletmeler listelenir/profil açılır; filtreler", async () => {
    const live = await makeBusiness(adminId, { name: `Görünür Berber ${uid()}` });
    const hidden = await makeBusiness(adminId, { name: `Gizli Berber ${uid()}` });
    await db.update(businesses).set({ status: "ACTIVE" }).where(eq(businesses.id, live.businessId));
    await db.update(businesses).set({ isPublished: true, ratingAvg: "4.80", ratingCount: 12 }).where(eq(businesses.id, live.businessId));
    const r = await searchBusinesses(db, { sirala: "onerilen", sayfa: 1, bugun: false, q: "Berber" });
    expect(r.cards.some((c) => c.id === live.businessId)).toBe(true);
    expect(r.cards.some((c) => c.id === hidden.businessId)).toBe(false);
    expect(await getPublicProfile(db, hidden.slug)).toBeNull();
    expect((await getPublicProfile(db, live.slug))?.name).toContain("Görünür");
    const minRating = await searchBusinesses(db, { sirala: "puan", sayfa: 1, bugun: false, puan: 4.5 });
    expect(minRating.cards.every((c) => c.ratingAvg >= 4.5)).toBe(true);
    // Konum: koordinatı olan işletmeler uzaklığa göre
    await db.update(businesses).set({ latitude: 41.0, longitude: 29.0 }).where(eq(businesses.id, live.businessId));
    const near = await searchBusinesses(db, { sirala: "yakin", sayfa: 1, bugun: false, lat: 41.01, lng: 29.0 });
    const me = near.cards.find((c) => c.id === live.businessId)!;
    expect(me.distanceKm).toBeGreaterThan(0.5);
    expect(me.distanceKm).toBeLessThan(2);
  });
});

describe("yorumlar ve Ayın İşletmesi", () => {
  async function setup() {
    const b = await makeBusiness(adminId);
    await db.update(businesses).set({ status: "ACTIVE" }).where(eq(businesses.id, b.businessId));
    await db.update(businesses).set({ isPublished: true }).where(eq(businesses.id, b.businessId));
    const s = await rawStaff(b.businessId);
    return { ...b, staffId: s.id };
  }
  async function completedAppt(b: Awaited<ReturnType<typeof setup>>, status: "COMPLETED" | "CONFIRMED" = "COMPLETED", daysAgo = 1) {
    const [c] = await db.insert(customers).values({ name: `Yorumcu ${uid()}`, email: `y-${uid()}@test.local`, phone: "+905550000000", passwordHash: await hashPassword("X1234567a"), kvkkConsentAt: new Date() }).returning();
    const [bc] = await db.insert(businessCustomers).values({ businessId: b.businessId, customerId: c!.id, displayName: c!.name }).returning();
    const st = new Date(Date.now() - daysAgo * 86_400_000);
    const [a] = await db
      .insert(appointments)
      .values({ businessId: b.businessId, staffId: b.staffId, businessCustomerId: bc!.id, customerId: c!.id, startsAt: st, endsAt: new Date(st.getTime() + 1_800_000), blockedUntil: new Date(st.getTime() + 1_800_000), status, source: "ONLINE", totalKurus: 100, confirmedAt: new Date() })
      .returning();
    return { customerId: c!.id, appointmentId: a!.id };
  }

  it("yalnızca kendi tamamlanmış randevusuna, bir kez; ortalama güncellenir; şikâyet → kaldırma ortalamadan düşer", async () => {
    const b = await setup();
    const x = await completedAppt(b);
    const y = await completedAppt(b);
    const pending = await completedAppt(b, "CONFIRMED");
    expect(await code(createReview(db, y.customerId, x.appointmentId, { rating: 5 }))).toBe("NOT_FOUND");
    expect(await code(createReview(db, pending.customerId, pending.appointmentId, { rating: 5 }))).toBe("VALIDATION");
    await createReview(db, x.customerId, x.appointmentId, { rating: 5, comment: "Harika" });
    expect(await code(createReview(db, x.customerId, x.appointmentId, { rating: 4 }))).toBe("CONFLICT");
    await createReview(db, y.customerId, y.appointmentId, { rating: 1, comment: "Hakaret içeren yorum" });
    let [row] = await db.select().from(businesses).where(eq(businesses.id, b.businessId));
    expect(row).toMatchObject({ ratingCount: 2, ratingAvg: "3.00" });

    const [bad] = await db.select().from(reviews).where(eq(reviews.appointmentId, y.appointmentId));
    const biz = { businessId: b.businessId, userId: b.userId };
    await reportReview(db, biz, bad!.id, { reason: "INSULT" });
    expect(await code(reportReview(db, biz, bad!.id, { reason: "INSULT" }))).toBe("CONFLICT");
    // Başka işletme bu yorumu şikâyet edemez
    const other = await setup();
    expect(await code(reportReview(db, { businessId: other.businessId, userId: other.userId }, bad!.id, { reason: "SPAM" }))).toBe("NOT_FOUND");
    const { listReports } = await import("@/server/modules/reviews/reviews");
    const rep = (await listReports(db, "OPEN")).find((r) => r.reviewId === bad!.id)!;
    await resolveReport(db, { adminId }, rep.id, { decision: "REMOVE", adminNote: "Hakaret" });
    [row] = await db.select().from(businesses).where(eq(businesses.id, b.businessId));
    expect(row).toMatchObject({ ratingCount: 1, ratingAvg: "5.00" });
    expect((await getPublicProfile(db, b.slug))!.reviews.map((r) => r.rating)).toEqual([5]);
  });

  it("aylık sıralama en az yorum şartı ve güven eşiği; ödül ay başına bir kez", async () => {
    await setSetting(db, "awards.minReviews", 3);
    const b = await setup();
    for (let i = 0; i < 3; i++) {
      const x = await completedAppt(b);
      await createReview(db, x.customerId, x.appointmentId, { rating: 5 });
    }
    await recalcRating(db, b.businessId);
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()).slice(0, 7);
    const r = await monthlyRanking(db, month);
    const me = r.rows.find((x) => x.businessId === b.businessId)!;
    expect(me).toMatchObject({ reviewCount: 3, avg: 5 });
    await awardMonth(db, { adminId }, month, b.businessId).catch(async (e) => {
      // Aynı ay testlerde daha önce verilmiş olabilir
      expect((e as AppError).code).toBe("CONFLICT");
    });
    expect(await code(awardMonth(db, { adminId }, month, b.businessId))).toBe("CONFLICT");
    const low = await setup();
    expect(await code(awardMonth(db, { adminId }, "2020-01", low.businessId))).toBe("VALIDATION");
    await setSetting(db, "awards.minReviews", 10);
    void like;
  });
});
