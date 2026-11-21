import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/server/db/client";
import { businessSubscriptions } from "@/server/db/schema";
import { audit } from "@/server/lib/audit";
import { logger } from "@/server/lib/logger";
import { recordPayment } from "./subscriptions";
import { notifyAdminPaymentReceived } from "./invoices";

/**
 * Otomatik yenilenen kart aboneliği için ödeme sağlayıcısı arayüzü (iyzico, PayTR vb.).
 * Şirket kurulup sağlayıcı seçildiğinde bu arayüzün bir uygulaması yazılır; uygulamanın geri kalanı değişmez.
 *
 * Akış:
 * 1. İşletme panelde "Kartımı tanımla"ya basar → startCardSetup sağlayıcının güvenli ödeme sayfasının adresini döner.
 *    Kart bilgisi yalnızca sağlayıcının sayfasına girilir; bizim sunucumuza hiç gelmez.
 * 2. Sağlayıcı aboneliği kurar ve her ay kartı otomatik çeker.
 * 3. Her çekim sonucunu webhook ile bildirir → parseWebhook imzayı doğrular → handleGatewayEvent işler.
 */
export interface PaymentGateway {
  readonly name: string;
  startCardSetup(input: { businessId: string; email: string; planCode: string; billingCycle: "MONTHLY" | "YEARLY"; feeKurus: number; returnUrl: string }): Promise<{ redirectUrl: string }>;
  cancelSubscription(providerSubscriptionRef: string): Promise<void>;
  /** Ödeme dönemi değişince sağlayıcıdaki tekrarlayan tutarı/aralığı günceller (bir sonraki çekimden itibaren). */
  updateSubscription(providerSubscriptionRef: string, input: { billingCycle: "MONTHLY" | "YEARLY"; feeKurus: number }): Promise<void>;
  /** İmza doğrulaması yapmalı; doğrulanamayan istek için hata fırlatmalı. */
  parseWebhook(req: Request): Promise<GatewayEvent>;
}

/**
 * Etkin ödeme sağlayıcısı. Şirket kurulup sağlayıcı seçildiğinde burada döndürülür (ör. ortam değişkenine göre).
 * Şu an bağlı sağlayıcı yok: kartla ödeme arayüzde pasif görünür.
 */
let gatewayOverride: PaymentGateway | null | undefined;
export function getPaymentGateway(): PaymentGateway | null {
  if (gatewayOverride !== undefined) return gatewayOverride;
  return null;
}
/** Yalnızca testler için. */
export function setPaymentGatewayForTests(g: PaymentGateway | null | undefined) {
  gatewayOverride = g;
}

export type GatewayEvent =
  | { type: "SUBSCRIPTION_ACTIVATED"; businessId: string; customerRef: string; subscriptionRef: string; cardBrand?: string; cardLast4?: string }
  | { type: "CHARGE_SUCCEEDED"; subscriptionRef: string; chargeRef: string; amountKurus: number; months: number; paidAt: Date }
  | { type: "CHARGE_FAILED"; subscriptionRef: string; reason?: string }
  | { type: "SUBSCRIPTION_CANCELLED"; subscriptionRef: string };

/** Sağlayıcı olaylarını işler. Aynı olay tekrar gelirse (sağlayıcılar yeniden dener) çift kayıt oluşmaz. */
export async function handleGatewayEvent(db: DB, provider: string, ev: GatewayEvent) {
  if (ev.type === "SUBSCRIPTION_ACTIVATED") {
    await db
      .update(businessSubscriptions)
      .set({
        paymentProvider: provider,
        providerCustomerRef: ev.customerRef,
        providerSubscriptionRef: ev.subscriptionRef,
        cardBrand: ev.cardBrand ?? null,
        cardLast4: ev.cardLast4 ?? null,
        autoRenew: true,
        updatedAt: new Date(),
      })
      .where(eq(businessSubscriptions.businessId, ev.businessId));
    await audit(db, { businessId: ev.businessId, action: "subscription.card_activated", meta: { provider } });
    return;
  }
  const [sub] = await db
    .select()
    .from(businessSubscriptions)
    .where(and(eq(businessSubscriptions.paymentProvider, provider), eq(businessSubscriptions.providerSubscriptionRef, ev.subscriptionRef)));
  if (!sub) {
    logger.warn("gateway_unknown_subscription", { provider, type: ev.type });
    return;
  }
  if (ev.type === "CHARGE_SUCCEEDED") {
    try {
      const payment = await recordPayment(db, null, sub.businessId, {
        months: ev.months,
        amount: (ev.amountKurus / 100).toFixed(2).replace(".", ","),
        method: "CARD",
        paidOn: ev.paidAt.toISOString().slice(0, 10),
        note: "Otomatik kart çekimi",
        provider,
        providerRef: ev.chargeRef,
      });
      // Her otomatik ödemede yöneticiye bilgi + fatura yükleme hatırlatması
      await notifyAdminPaymentReceived(db, payment.id);
    } catch (e) {
      // Aynı çekim daha önce kaydedildiyse (provider_ref benzersiz) sessizce geç
      if ((e as { code?: string }).code === "CONFLICT") return;
      throw e;
    }
  } else if (ev.type === "CHARGE_FAILED") {
    // Ek işlem gerekmez: dönem uzamadığı için abonelik gecikmeye düşer; günlük kontrol e-posta gönderir ve süre dolunca askıya alır.
    await audit(db, { businessId: sub.businessId, action: "subscription.charge_failed", meta: { provider, reason: ev.reason } });
  } else if (ev.type === "SUBSCRIPTION_CANCELLED") {
    await db.update(businessSubscriptions).set({ autoRenew: false, updatedAt: new Date() }).where(eq(businessSubscriptions.id, sub.id));
    await audit(db, { businessId: sub.businessId, action: "subscription.card_cancelled", meta: { provider } });
  }
}
