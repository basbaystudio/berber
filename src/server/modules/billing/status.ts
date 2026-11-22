import { diffDays } from "@/lib/dates";
import { formatTL } from "@/lib/money";

export type SubscriptionStatusKind = "FREE_PERIOD" | "TRIAL" | "PAID" | "PAST_DUE" | "CANCELLED";

export type SubscriptionStatus = {
  kind: SubscriptionStatusKind;
  label: string;
  /** Deneme/ödenmiş dönemde kalan gün; gecikmede geçen gün */
  days?: number;
  /** Bir sonraki ödemenin vadesi (dahil son günden sonraki gün değil, son kapsanan gün) */
  coveredUntil?: string | null;
  /** Tek seferlik ödeme yapılmış: süresiz kullanım */
  lifetime?: boolean;
};

export type BillingCycle = "MONTHLY" | "YEARLY" | "LIFETIME";

/** Tek seferlik ödemede kapsanan son gün (süresiz kullanım). */
export const LIFETIME_UNTIL = "2099-12-31";

/**
 * Abonelik durumunu tarihlerden hesaplar (saklanmaz, böylece zamanlanmış görev gerektirmez).
 * Saf fonksiyon: test edilebilir.
 */
export function computeSubscriptionStatus(
  sub: { trialEndsOn: string | null; paidThrough: string | null; cancelledAt: Date | null },
  billingEnabled: boolean,
  today: string,
): SubscriptionStatus {
  if (sub.cancelledAt) return { kind: "CANCELLED", label: "İptal edildi" };
  if (!billingEnabled || !sub.trialEndsOn) return { kind: "FREE_PERIOD", label: "Ücretsiz dönem" };
  if (sub.paidThrough && sub.paidThrough >= LIFETIME_UNTIL) return { kind: "PAID", label: "Süresiz (tek seferlik)", lifetime: true, coveredUntil: sub.paidThrough };
  if (today <= sub.trialEndsOn)
    return { kind: "TRIAL", label: "Ücretsiz deneme", days: diffDays(sub.trialEndsOn, today) + 1, coveredUntil: sub.trialEndsOn };
  if (sub.paidThrough && today <= sub.paidThrough)
    return { kind: "PAID", label: "Ödendi", days: diffDays(sub.paidThrough, today) + 1, coveredUntil: sub.paidThrough };
  const lastCovered = sub.paidThrough && sub.paidThrough > sub.trialEndsOn ? sub.paidThrough : sub.trialEndsOn;
  return { kind: "PAST_DUE", label: "Ödeme gecikti", days: diffDays(today, lastCovered), coveredUntil: lastCovered };
}

/**
 * Ücretsiz süresi bitmiş ve ödemesi kurulmamış işletme: panelde kapatılamayan "kart bilgisi girin" penceresi gösterilir.
 * Kartla otomatik ödeme kuruluysa ya da dönem ödenmişse gösterilmez. Ücretlendirme kapalıyken hiç gösterilmez.
 */
export function needsPaymentSetup(
  sub: { trialEndsOn: string | null; paidThrough: string | null; cancelledAt: Date | null; autoRenew: boolean; cardLast4: string | null },
  billingEnabled: boolean,
  today: string,
): boolean {
  if (!billingEnabled || !sub.trialEndsOn || sub.cancelledAt) return false;
  if (today <= sub.trialEndsOn) return false;
  if (sub.autoRenew && sub.cardLast4) return false;
  if (sub.paidThrough && today <= sub.paidThrough) return false;
  return true;
}

/** Abonelik dönemine göre geçerli ücret. */
export function currentFee(sub: { billingCycle: string; monthlyFeeKurus: number; yearlyFeeKurus: number | null; lifetimeFeeKurus?: number | null }) {
  if (sub.billingCycle === "LIFETIME" && sub.lifetimeFeeKurus != null)
    return { kurus: sub.lifetimeFeeKurus, months: 0, unit: "tek seferlik", label: "Tek seferlik" as const, text: `${formatTL(sub.lifetimeFeeKurus)} tek seferlik` };
  if (sub.billingCycle === "YEARLY" && sub.yearlyFeeKurus != null)
    return { kurus: sub.yearlyFeeKurus, months: 12, unit: "yıl", label: "Yıllık" as const, text: `${formatTL(sub.yearlyFeeKurus)} / yıl` };
  return { kurus: sub.monthlyFeeKurus, months: 1, unit: "ay", label: "Aylık" as const, text: `${formatTL(sub.monthlyFeeKurus)} / ay` };
}
