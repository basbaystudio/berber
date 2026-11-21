import { diffDays } from "@/lib/dates";

export type SubscriptionStatusKind = "FREE_PERIOD" | "TRIAL" | "PAID" | "PAST_DUE" | "CANCELLED";

export type SubscriptionStatus = {
  kind: SubscriptionStatusKind;
  label: string;
  /** Deneme/ödenmiş dönemde kalan gün; gecikmede geçen gün */
  days?: number;
  /** Bir sonraki ödemenin vadesi (dahil son günden sonraki gün değil, son kapsanan gün) */
  coveredUntil?: string | null;
};

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
export function currentFee(sub: { billingCycle: string; monthlyFeeKurus: number; yearlyFeeKurus: number | null }) {
  const yearly = sub.billingCycle === "YEARLY" && sub.yearlyFeeKurus != null;
  return yearly
    ? { kurus: sub.yearlyFeeKurus!, months: 12, unit: "yıl", label: "Yıllık" as const }
    : { kurus: sub.monthlyFeeKurus, months: 1, unit: "ay", label: "Aylık" as const };
}
