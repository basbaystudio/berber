/**
 * Güven puanı hesabı (saf fonksiyon). Ağırlıklar ve başlangıç puanı platform ayarlarından gelir.
 * Talep sayısı az olan işletmeler haksız cezalandırılmasın diye talebe dayalı bileşenler
 * başlangıç değerine doğru yumuşatılır (az veri → başlangıç puanına yakın).
 */
export type TrustRaw = {
  decided: number; // süresinde onaylanan/reddedilen online talep
  expired: number; // süresi içinde onaylanmayan talep
  /** Yanıt süresi medyanı; süresi dolan talepler en yavaş yanıt (onay süresi) olarak sayılır. */
  medianResponseMin: number | null;
  confirmed: number; // onaylanan randevu
  cancelledAfterConfirm: number; // işletmenin onayladıktan sonra iptal ettiği
  resolved: number; // saati geçmiş ve sonuçlandırılmış (tamamlandı/gelmedi)
  unresolved: number; // saati 1 günden fazla geçmiş ama hâlâ "onaylı" kalan
  daysSinceActivity: number | null;
};

export type TrustWeights = { confirmation: number; responseSpeed: number; businessCancellation: number; closure: number; activity: number };
export type TrustPrior = { score: number; fullConfidenceSamples: number };

export type TrustComponents = Record<keyof TrustWeights, number | null>;

export function trustComponents(r: TrustRaw): TrustComponents {
  const requests = r.decided + r.expired;
  return {
    // Kaçırılan her talep ağır cezalandırılır: %50 ve üzeri kaçırma → 0
    confirmation: requests ? Math.max(0, 1 - (r.expired / requests) * 2) : null,
    responseSpeed: r.medianResponseMin == null ? null : r.medianResponseMin <= 30 ? 1 : Math.max(0, 1 - (r.medianResponseMin - 30) / 330),
    businessCancellation: r.confirmed ? Math.max(0, 1 - (r.cancelledAfterConfirm / r.confirmed) * 3) : null,
    closure: r.resolved + r.unresolved ? r.resolved / (r.resolved + r.unresolved) : null,
    activity: r.daysSinceActivity == null ? 0 : r.daysSinceActivity <= 1 ? 1 : Math.max(0, 1 - (r.daysSinceActivity - 1) / 13),
  };
}

export function trustScore(r: TrustRaw, w: TrustWeights, prior: TrustPrior): { score: number; components: TrustComponents; confidence: number } {
  const c = trustComponents(r);
  const p = prior.score / 100;
  const confidence = Math.min(1, (r.decided + r.expired + r.confirmed) / Math.max(1, prior.fullConfidenceSamples));
  const blend = (x: number | null) => p * (1 - confidence) + (x ?? p) * confidence;
  const total = w.confirmation + w.responseSpeed + w.businessCancellation + w.closure + w.activity;
  const s =
    (w.confirmation * blend(c.confirmation) +
      w.responseSpeed * blend(c.responseSpeed) +
      w.businessCancellation * blend(c.businessCancellation) +
      w.closure * blend(c.closure) +
      w.activity * (c.activity ?? 0)) /
    (total || 1);
  return { score: Math.round(s * 1000) / 10, components: c, confidence };
}

/** İşletmeye gösterilecek açıklamalar (neden puan kaybettiği). */
export function trustReasons(r: TrustRaw): { ok: boolean; text: string }[] {
  const out: { ok: boolean; text: string }[] = [];
  if (r.expired > 0) out.push({ ok: false, text: `Son 30 günde ${r.expired} randevu talebi süresi içinde onaylanmadı.` });
  else if (r.decided > 0) out.push({ ok: true, text: "Tüm talepleri süresi içinde yanıtladınız." });
  if (r.medianResponseMin != null) {
    const m = Math.round(r.medianResponseMin);
    const txt = m < 60 ? `${m} dakika` : `${Math.floor(m / 60)} saat ${m % 60} dakika`;
    out.push({ ok: m <= 30, text: `Taleplere ortalama yanıt süreniz: ${txt}.` });
  }
  if (r.cancelledAfterConfirm > 0) out.push({ ok: false, text: `${r.cancelledAfterConfirm} onaylı randevuyu siz iptal ettiniz.` });
  if (r.unresolved > 0) out.push({ ok: false, text: `${r.unresolved} geçmiş randevu "Tamamlandı" ya da "Gelmedi" olarak işaretlenmedi.` });
  if (r.daysSinceActivity == null || r.daysSinceActivity > 3) out.push({ ok: false, text: r.daysSinceActivity == null ? "Panele henüz giriş yapılmadı." : `Panele en son ${r.daysSinceActivity} gün önce girildi.` });
  return out;
}
