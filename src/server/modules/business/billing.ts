import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businessSubscriptions, businesses, subscriptionPayments, subscriptionPlans } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { getSetting } from "@/server/modules/platform/settings";
import { getPaymentGateway } from "@/server/modules/billing/gateway";
import { computeSubscriptionStatus, currentFee } from "@/server/modules/billing/status";
import { todayTR } from "@/lib/dates";
import { bizAudit, type Biz } from "./context";

/** İşletmenin kendi abonelik bilgisi (yalnızca kendi kaydı). */
export async function getMyBilling(db: Executor, businessId: string) {
  const [row] = await db
    .select({ sub: businessSubscriptions, plan: subscriptionPlans })
    .from(businessSubscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, businessSubscriptions.planId))
    .where(eq(businessSubscriptions.businessId, businessId));
  if (!row) throw notFound("Abonelik");
  const billing = await getSetting(db, "billing.status");
  const payments = await db
    .select({
      id: subscriptionPayments.id,
      amountKurus: subscriptionPayments.amountKurus,
      months: subscriptionPayments.months,
      coversFrom: subscriptionPayments.coversFrom,
      coversTo: subscriptionPayments.coversTo,
      method: subscriptionPayments.method,
      paidAt: subscriptionPayments.paidAt,
      invoiceKey: subscriptionPayments.invoiceKey,
    })
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.businessId, businessId))
    .orderBy(desc(subscriptionPayments.paidAt));
  return {
    ...row,
    status: computeSubscriptionStatus(row.sub, billing.enabled, todayTR()),
    billingEnabled: billing.enabled,
    // Depolama anahtarı istemciye gönderilmez; yalnızca fatura olup olmadığı
    payments: payments.map(({ invoiceKey, ...p }) => ({ ...p, hasInvoice: !!invoiceKey })),
    bank: await getSetting(db, "billing.bankTransfer"),
    cardPaymentsAvailable: getPaymentGateway() !== null,
  };
}

export const methodSchema = z.object({ method: z.enum(["CARD", "BANK_TRANSFER"], { error: "Ödeme yöntemi seçin." }) });

/** Ödeme yöntemi değişikliği. Karttan havaleye geçilirse sağlayıcıdaki otomatik çekim iptal edilir. */
export async function setPaymentMethod(db: DB, biz: Biz, method: "CARD" | "BANK_TRANSFER") {
  const [sub] = await db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, biz.businessId));
  if (!sub) throw notFound("Abonelik");
  if (sub.preferredMethod === method) return;
  if (method === "BANK_TRANSFER" && sub.autoRenew && sub.providerSubscriptionRef) {
    const gw = getPaymentGateway();
    if (!gw) throw new AppError("INTERNAL", "Otomatik ödeme şu an iptal edilemedi. Lütfen platform yönetimiyle iletişime geçin.");
    await gw.cancelSubscription(sub.providerSubscriptionRef);
  }
  await db
    .update(businessSubscriptions)
    .set({ preferredMethod: method, ...(method === "BANK_TRANSFER" ? { autoRenew: false } : {}), updatedAt: new Date() })
    .where(eq(businessSubscriptions.id, sub.id));
  await audit(db, { ...bizAudit(biz), action: "subscription.method_change", meta: { method } });
}

/**
 * Kart tanımlama / değiştirme: sağlayıcının güvenli ödeme sayfasının adresini döner.
 * Kart bilgisi sunucumuza hiç gelmez; sonuç sağlayıcının bildirimiyle (webhook) işlenir.
 */
export async function startCardSetup(db: DB, biz: Biz, returnUrl: string) {
  const gw = getPaymentGateway();
  if (!gw) throw new AppError("VALIDATION", "Kartla ödeme henüz aktif değil. Ücretlendirme başladığında buradan kartınızı tanımlayabileceksiniz.");
  const [row] = await db
    .select({ sub: businessSubscriptions, plan: subscriptionPlans, email: businesses.email })
    .from(businessSubscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, businessSubscriptions.planId))
    .innerJoin(businesses, eq(businesses.id, businessSubscriptions.businessId))
    .where(eq(businessSubscriptions.businessId, biz.businessId));
  if (!row) throw notFound("Abonelik");
  if (!row.email) throw new AppError("VALIDATION", "İşletme e-posta adresi tanımlı değil. Lütfen platform yönetimiyle iletişime geçin.");
  const { redirectUrl } = await gw.startCardSetup({
    businessId: biz.businessId,
    email: row.email,
    planCode: row.plan.code,
    billingCycle: row.sub.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY",
    feeKurus: currentFee(row.sub).kurus,
    returnUrl,
  });
  await audit(db, { ...bizAudit(biz), action: "subscription.card_setup_started", meta: { provider: gw.name } });
  return redirectUrl;
}

export const cycleSchema = z.object({ cycle: z.enum(["MONTHLY", "YEARLY"], { error: "Ödeme dönemi seçin." }) });

/** Aylık ↔ yıllık ödeme dönemi değişikliği (bir sonraki ödemeden itibaren geçerli). */
export async function setBillingCycle(db: DB, biz: Biz, cycle: "MONTHLY" | "YEARLY") {
  const [sub] = await db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, biz.businessId));
  if (!sub) throw notFound("Abonelik");
  if (cycle === "YEARLY" && sub.yearlyFeeKurus == null) throw new AppError("VALIDATION", "Paketinizde yıllık ödeme seçeneği yok.");
  if (sub.billingCycle === cycle) return;
  const gw = getPaymentGateway();
  if (gw && sub.providerSubscriptionRef && sub.autoRenew) {
    await gw.updateSubscription(sub.providerSubscriptionRef, { billingCycle: cycle, feeKurus: currentFee({ ...sub, billingCycle: cycle }).kurus });
  }
  await db.update(businessSubscriptions).set({ billingCycle: cycle, updatedAt: new Date() }).where(eq(businessSubscriptions.id, sub.id));
  await audit(db, { ...bizAudit(biz), action: "subscription.cycle_change", meta: { cycle } });
}
