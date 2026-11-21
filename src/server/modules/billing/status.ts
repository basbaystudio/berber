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
