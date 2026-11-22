import "server-only";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businessSubscriptions, businesses, subscriptionPayments, subscriptionPlans } from "@/server/db/schema";
import { AppError, notFound, pgErrorCode, PG } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { getSetting, setSetting } from "@/server/modules/platform/settings";
import { addDaysStr, maxDateStr, periodEnd, todayTR } from "@/lib/dates";
import { checkbox, optionalText, trimmed } from "@/lib/validation/common";
import { parseTLToKurus } from "@/lib/money";
import { computeSubscriptionStatus, LIFETIME_UNTIL } from "./status";

type Actor = { adminId: string; ip?: string | null };

/* ───────────── Paketler ───────────── */

const priceField = z.preprocess(
  (v) => (typeof v === "string" ? parseTLToKurus(v) : v),
  z.number({ error: "Geçerli bir fiyat girin (örn. 900 veya 899,90)." }).int().min(0, "Fiyat negatif olamaz.").max(100_000_00, "Fiyat çok yüksek."),
);

export const planSchema = z.object({
  name: trimmed(2, 60, "Paket adı"),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "Kod yalnızca küçük harf, rakam ve tire içerebilir (örn. premium-plus)."),
  description: optionalText(500, "Açıklama"),
  monthlyPriceKurus: priceField,
  yearlyPriceKurus: z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? parseTLToKurus(v) : v), z.number({ error: "Geçerli bir yıllık fiyat girin." }).int().min(0).max(1_000_000_00).nullable()),
  lifetimePriceKurus: z.preprocess((v) => (v === "" || v == null ? null : typeof v === "string" ? parseTLToKurus(v) : v), z.number({ error: "Geçerli bir tek seferlik fiyat girin." }).int().min(0).max(1_000_000_00).nullable()),
  highlights: z.preprocess(
    (v) => (typeof v === "string" ? v.split("\n").map((x) => x.trim()).filter(Boolean) : v),
    z.array(z.string().max(120, "Her madde en fazla 120 karakter olabilir.")).max(12, "En fazla 12 madde."),
  ),
  isActive: checkbox,
  sortOrder: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(999)),
});
export type PlanInput = z.infer<typeof planSchema>;

export function listPlans(db: Executor) {
  return db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.monthlyPriceKurus));
}

function planConflict(e: unknown): never {
  if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw new AppError("CONFLICT", "Bu kod başka bir pakette kullanılıyor.", { code: "Bu kod kullanılıyor." });
  throw e;
}

export async function createPlan(db: DB, actor: Actor, input: PlanInput) {
  try {
    const [p] = await db.insert(subscriptionPlans).values(input).returning();
    await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "plan.create", entity: "plan", entityId: p!.id, meta: { code: input.code }, ip: actor.ip });
    return p!;
  } catch (e) {
    planConflict(e);
  }
}

export async function updatePlan(db: DB, actor: Actor, id: string, input: PlanInput) {
  try {
    await db.transaction(async (tx) => {
      const [cur] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).for("update");
      if (!cur) throw notFound("Paket");
      if (cur.isDefault && !input.isActive) throw new AppError("VALIDATION", "Varsayılan paket pasif yapılamaz. Önce başka bir paketi varsayılan yapın.");
      await tx.update(subscriptionPlans).set({ ...input, updatedAt: new Date() }).where(eq(subscriptionPlans.id, id));
      await audit(tx, { actorRealm: "ADMIN", actorId: actor.adminId, action: "plan.update", entity: "plan", entityId: id, ip: actor.ip });
    });
  } catch (e) {
    planConflict(e);
  }
}

/** Yeni işletmelere atanacak varsayılan paket (her zaman tek). */
export async function setDefaultPlan(db: DB, actor: Actor, id: string) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    if (!p) throw notFound("Paket");
    if (!p.isActive) throw new AppError("VALIDATION", "Pasif paket varsayılan yapılamaz.");
    await tx.update(subscriptionPlans).set({ isDefault: false }).where(eq(subscriptionPlans.isDefault, true));
    await tx.update(subscriptionPlans).set({ isDefault: true }).where(eq(subscriptionPlans.id, id));
    await audit(tx, { actorRealm: "ADMIN", actorId: actor.adminId, action: "plan.set_default", entity: "plan", entityId: id, ip: actor.ip });
  });
}

/* ───────────── İşletme aboneliği ───────────── */

/** Kampanya sayımı için global kilit anahtarı (aynı anda oluşturulan işletmeler sırayla değerlendirilir). */
const EARLY_ADOPTER_LOCK = 482_150_001;

/**
 * Yeni işletmeye varsayılan paketle abonelik açar. İlk N işletme uzun deneme alır.
 * Transaction içinde çağrılmalıdır; advisory lock sayesinde eşzamanlı oluşturmada N aşılmaz.
 */
export async function assignInitialSubscription(tx: Executor, businessId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${EARLY_ADOPTER_LOCK})`);
  const [plan] = await tx.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.isDefault, true), eq(subscriptionPlans.isActive, true))).limit(1);
  if (!plan) throw new AppError("INTERNAL", "Varsayılan abonelik paketi tanımlı değil. Abonelikler sayfasından bir paketi varsayılan yapın.");
  const early = await getSetting(tx, "billing.earlyAdopter");
  const defaultTrial = await getSetting(tx, "billing.defaultTrialMonths");
  const billing = await getSetting(tx, "billing.status");
  const [{ n }] = (await tx.select({ n: count() }).from(businessSubscriptions).where(eq(businessSubscriptions.isEarlyAdopter, true))) as [{ n: number }];
  const isEarlyAdopter = n < early.limit;
  const trialMonths = isEarlyAdopter ? early.trialMonths : defaultTrial;
  const today = todayTR();
  const [sub] = await tx
    .insert(businessSubscriptions)
    .values({
      businessId,
      planId: plan.id,
      monthlyFeeKurus: plan.monthlyPriceKurus,
      yearlyFeeKurus: plan.yearlyPriceKurus,
      lifetimeFeeKurus: plan.lifetimePriceKurus,
      trialMonths,
      isEarlyAdopter,
      // Ücretlendirme kapalıyken deneme süresi başlamaz; açıldığı gün başlar.
      trialStartsOn: billing.enabled ? today : null,
      trialEndsOn: billing.enabled ? (trialMonths > 0 ? periodEnd(today, trialMonths) : addDaysStr(today, -1)) : null,
    })
    .returning();
  return sub!;
}

/** Ücretlendirmeyi başlatır: deneme süresi henüz başlamamış tüm işletmelerin denemesi bugün başlar. */
export async function enableBilling(db: DB, actor: Actor) {
  await db.transaction(async (tx) => {
    const cur = await getSetting(tx, "billing.status");
    if (cur.enabled) return;
    const today = todayTR();
    await setSetting(tx, "billing.status", { enabled: true, liveSince: cur.liveSince ?? today }, actor.adminId);
    await tx.execute(sql`
      UPDATE business_subscriptions
         SET trial_starts_on = ${today}::date,
             trial_ends_on = (${today}::date + make_interval(months => trial_months) - interval '1 day')::date,
             updated_at = now()
       WHERE trial_starts_on IS NULL`);
    await audit(tx, { actorRealm: "ADMIN", actorId: actor.adminId, action: "billing.enable", ip: actor.ip });
  });
}

/** Ücretlendirmeyi durdurur (herkes yeniden ücretsiz); mevcut tarihler korunur. */
export async function disableBilling(db: DB, actor: Actor) {
  const cur = await getSetting(db, "billing.status");
  await setSetting(db, "billing.status", { enabled: false, liveSince: cur.liveSince }, actor.adminId);
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "billing.disable", ip: actor.ip });
}

export const campaignSchema = z.object({
  earlyLimit: z.coerce.number({ error: "Sayı girin." }).int().min(0, "0 veya daha büyük olmalı.").max(10000),
  earlyTrialMonths: z.coerce.number({ error: "Sayı girin." }).int().min(0).max(36, "En fazla 36 ay."),
  defaultTrialMonths: z.coerce.number({ error: "Sayı girin." }).int().min(0).max(36, "En fazla 36 ay."),
  graceDays: z.coerce.number({ error: "Sayı girin." }).int().min(1, "En az 1 gün.").max(60, "En fazla 60 gün."),
});

export async function updateCampaign(db: DB, actor: Actor, input: z.infer<typeof campaignSchema>) {
  await db.transaction(async (tx) => {
    await setSetting(tx, "billing.earlyAdopter", { limit: input.earlyLimit, trialMonths: input.earlyTrialMonths }, actor.adminId);
    await setSetting(tx, "billing.defaultTrialMonths", input.defaultTrialMonths, actor.adminId);
    await setSetting(tx, "billing.graceDays", input.graceDays, actor.adminId);
    await audit(tx, { actorRealm: "ADMIN", actorId: actor.adminId, action: "billing.campaign_update", meta: input, ip: actor.ip });
  });
}

export async function getBillingOverview(db: Executor) {
  const [billing, early, defaultTrial, graceDays] = [
    await getSetting(db, "billing.status"),
    await getSetting(db, "billing.earlyAdopter"),
    await getSetting(db, "billing.defaultTrialMonths"),
    await getSetting(db, "billing.graceDays"),
  ];
  const [{ n }] = (await db.select({ n: count() }).from(businessSubscriptions).where(eq(businessSubscriptions.isEarlyAdopter, true))) as [{ n: number }];
  return { billing, early, defaultTrial, graceDays, earlyUsed: n };
}

export async function getBusinessSubscription(db: Executor, businessId: string) {
  const [row] = await db
    .select({ sub: businessSubscriptions, plan: subscriptionPlans })
    .from(businessSubscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, businessSubscriptions.planId))
    .where(eq(businessSubscriptions.businessId, businessId))
    .limit(1);
  if (!row) return null;
  const billing = await getSetting(db, "billing.status");
  const status = computeSubscriptionStatus(row.sub, billing.enabled, todayTR());
  return { ...row, status, billingEnabled: billing.enabled };
}

export async function listBusinessPayments(db: Executor, businessId: string) {
  return db
    .select({ p: subscriptionPayments, planName: subscriptionPlans.name })
    .from(subscriptionPayments)
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptionPayments.planId))
    .where(eq(subscriptionPayments.businessId, businessId))
    .orderBy(desc(subscriptionPayments.paidAt));
}

export const changePlanSchema = z.object({
  planId: z.string().uuid("Paket seçin."),
  customFee: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
  customYearlyFee: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
  customLifetimeFee: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional()),
  billingCycle: z.enum(["MONTHLY", "YEARLY", "LIFETIME"]).optional(),
  trialMonths: z.coerce.number().int().min(0).max(36, "En fazla 36 ay."),
  note: optionalText(500, "Not"),
});

/** Paket/ücret/deneme süresi değişikliği. Ücret boşsa paketin güncel fiyatı kilitlenir. */
export async function updateBusinessSubscription(db: DB, actor: Actor, businessId: string, input: z.infer<typeof changePlanSchema>) {
  await db.transaction(async (tx) => {
    const [sub] = await tx.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, businessId)).for("update");
    if (!sub) throw notFound("Abonelik");
    const [plan] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.planId));
    if (!plan) throw new AppError("VALIDATION", "Paket bulunamadı.", { planId: "Paket bulunamadı." });
    if (!plan.isActive && plan.id !== sub.planId) throw new AppError("VALIDATION", "Pasif pakete geçilemez.", { planId: "Bu paket pasif." });
    let fee = plan.monthlyPriceKurus;
    if (input.customFee !== undefined) {
      const k = parseTLToKurus(input.customFee);
      if (k === null || k < 0) throw new AppError("VALIDATION", "Geçerli bir ücret girin.", { customFee: "Geçerli bir ücret girin." });
      fee = k;
    }
    let yearlyFee = plan.yearlyPriceKurus;
    if (input.customYearlyFee !== undefined) {
      const k = parseTLToKurus(input.customYearlyFee);
      if (k === null || k < 0) throw new AppError("VALIDATION", "Geçerli bir yıllık ücret girin.", { customYearlyFee: "Geçerli bir ücret girin." });
      yearlyFee = k;
    }
    let lifetimeFee = plan.lifetimePriceKurus;
    if (input.customLifetimeFee !== undefined) {
      const k = parseTLToKurus(input.customLifetimeFee);
      if (k === null || k < 0) throw new AppError("VALIDATION", "Geçerli bir tek seferlik ücret girin.", { customLifetimeFee: "Geçerli bir ücret girin." });
      lifetimeFee = k;
    }
    const wanted = input.billingCycle ?? sub.billingCycle;
    if (input.billingCycle === "YEARLY" && yearlyFee == null) throw new AppError("VALIDATION", "Bu pakette yıllık ücret yok.", { billingCycle: "Yıllık ücret tanımlı değil." });
    if (input.billingCycle === "LIFETIME" && lifetimeFee == null) throw new AppError("VALIDATION", "Bu pakette tek seferlik ücret yok.", { billingCycle: "Tek seferlik ücret tanımlı değil." });
    // Paket seçili dönemi sunmuyorsa aylığa döner
    const cycle = (wanted === "YEARLY" && yearlyFee == null) || (wanted === "LIFETIME" && lifetimeFee == null) ? "MONTHLY" : wanted;
    const trialEndsOn = sub.trialStartsOn
      ? input.trialMonths > 0
        ? periodEnd(sub.trialStartsOn, input.trialMonths)
        : addDaysStr(sub.trialStartsOn, -1)
      : null;
    await tx
      .update(businessSubscriptions)
      .set({
        planId: plan.id,
        monthlyFeeKurus: fee,
        yearlyFeeKurus: yearlyFee,
        lifetimeFeeKurus: lifetimeFee,
        // Paket seçili dönemi sunmuyorsa aylığa döner
        billingCycle: cycle,
        trialMonths: input.trialMonths,
        trialEndsOn,
        note: input.note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(businessSubscriptions.id, sub.id));
    await audit(tx, {
      actorRealm: "ADMIN",
      actorId: actor.adminId,
      businessId,
      action: "subscription.update",
      entity: "subscription",
      entityId: sub.id,
      meta: { plan: plan.code, feeKurus: fee, cycle, trialMonths: input.trialMonths },
      ip: actor.ip,
    });
  });
}

export const paymentSchema = z.object({
  months: z.coerce.number({ error: "Ay sayısı girin." }).int().min(1, "En az 1 ay.").max(36, "En fazla 36 ay."),
  amount: z.string().trim().min(1, "Tutar girin."),
  method: z.enum(["BANK_TRANSFER", "CASH", "CARD", "OTHER"], { error: "Ödeme yöntemi seçin." }),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih seçin."),
  note: optionalText(500, "Not"),
});

/**
 * Ödeme kaydı. Kapsanan dönem, son kapsanan günden (deneme sonu ya da önceki ödeme) itibaren devam eder.
 * İleride kartla online ödemede de aynı fonksiyon (method CARD + provider/providerRef) kullanılacak.
 */
export async function recordPayment(
  db: DB,
  actor: Actor | null,
  businessId: string,
  input: z.infer<typeof paymentSchema> & { provider?: string; providerRef?: string },
) {
  const amountKurus = parseTLToKurus(input.amount);
  if (amountKurus === null || amountKurus < 0) throw new AppError("VALIDATION", "Geçerli bir tutar girin.", { amount: "Geçerli bir tutar girin." });
  return db.transaction(async (tx) => {
    const billing = await getSetting(tx, "billing.status");
    if (!billing.enabled) throw new AppError("VALIDATION", "Ücretlendirme kapalıyken ödeme kaydedilemez. Şu an tüm işletmeler ücretsiz dönemde.");
    const [sub] = await tx
      .select()
      .from(businessSubscriptions)
      .where(and(eq(businessSubscriptions.businessId, businessId), isNull(businessSubscriptions.cancelledAt)))
      .for("update");
    if (!sub || !sub.trialEndsOn) throw notFound("Aktif abonelik");
    const lastCovered = maxDateStr(sub.paidThrough, sub.trialEndsOn)!;
    if (lastCovered >= LIFETIME_UNTIL) throw new AppError("VALIDATION", "Bu işletme tek seferlik ödeme yaptı; süresiz kullanımda. Yeni ödeme gerekmez.");
    const coversFrom = addDaysStr(lastCovered, 1);
    // Tek seferlik ödeme: süresiz kullanım (ay sayısı 0 olarak kaydedilir)
    const lifetime = sub.billingCycle === "LIFETIME";
    const months = lifetime ? 0 : input.months;
    const coversTo = lifetime ? LIFETIME_UNTIL : periodEnd(coversFrom, input.months);
    try {
      const [p] = await tx
        .insert(subscriptionPayments)
        .values({
          businessId,
          subscriptionId: sub.id,
          planId: sub.planId,
          amountKurus,
          months,
          coversFrom,
          coversTo,
          method: input.method,
          provider: input.provider ?? null,
          providerRef: input.providerRef ?? null,
          paidAt: new Date(`${input.paidOn}T12:00:00+03:00`),
          note: input.note ?? null,
          recordedByAdminId: actor?.adminId ?? null,
        })
        .returning();
      await tx.update(businessSubscriptions).set({ paidThrough: coversTo, updatedAt: new Date() }).where(eq(businessSubscriptions.id, sub.id));
      // Ödeme gecikmesi nedeniyle askıya alınmışsa ve artık gecikme yoksa otomatik yeniden aç
      const [b] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update");
      if (b && b.status === "SUSPENDED" && b.suspendedReason === "BILLING" && coversTo >= todayTR()) {
        await tx
          .update(businesses)
          .set({
            status: "ACTIVE",
            suspendedReason: null,
            isPublished: b.republishOnReactivate,
            republishOnReactivate: false,
            updatedAt: new Date(),
          })
          .where(eq(businesses.id, businessId));
        await audit(tx, { actorRealm: actor ? "ADMIN" : null, actorId: actor?.adminId ?? null, businessId, action: "business.reactivate_billing", entity: "business", entityId: businessId });
      }
      await audit(tx, {
        actorRealm: actor ? "ADMIN" : null,
        actorId: actor?.adminId ?? null,
        businessId,
        action: "subscription.payment",
        entity: "payment",
        entityId: p!.id,
        meta: { amountKurus, months: input.months, coversFrom, coversTo },
        ip: actor?.ip ?? null,
      });
      return p!;
    } catch (e) {
      if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw new AppError("CONFLICT", "Bu ödeme işlemi zaten kaydedilmiş.");
      throw e;
    }
  });
}

/** Admin abonelik listesi (durum hesaplanmış). */
export async function listSubscriptions(db: Executor) {
  const billing = await getSetting(db, "billing.status");
  const today = todayTR();
  const rows = await db
    .select({ sub: businessSubscriptions, plan: subscriptionPlans, businessName: businesses.name, businessStatus: businesses.status })
    .from(businessSubscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, businessSubscriptions.planId))
    .innerJoin(businesses, eq(businesses.id, businessSubscriptions.businessId))
    .orderBy(asc(businessSubscriptions.createdAt));
  return rows.map((r) => ({ ...r, status: computeSubscriptionStatus(r.sub, billing.enabled, today) }));
}
