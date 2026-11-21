/**
 * Varsayılan platform ayarları. Değerler veritabanındaki platform_settings tablosunda tutulur ve
 * admin tarafından değiştirilebilir; buradaki değerler yalnızca ilk kurulum içindir.
 */
export const DEFAULT_PLATFORM_SETTINGS = {
  /** Bekleyen online randevunun onaylanması için süre (saat). */
  "booking.confirmWindowHours": 6,
  /** Müşterinin iptal/değişiklik yapabileceği son an: randevudan kaç dakika önce. */
  "booking.customerCancelCutoffMinutes": 120,
  /** Güven puanı ağırlıkları (toplam 1). */
  "trust.weights": { confirmation: 0.4, responseSpeed: 0.2, businessCancellation: 0.2, closure: 0.1, activity: 0.1 },
  /** Yeni işletme başlangıç puanı ve tam güven için gereken talep sayısı. */
  "trust.prior": { score: 70, fullConfidenceSamples: 10 },
  /** Bu puanın altındaki işletmeler vitrinlere (öne çıkanlar / bugün müsait) giremez. */
  "trust.showcaseThreshold": 40,
  /**
   * Ücretlendirme: kapalıyken (deneme/lansman öncesi) tüm işletmeler ücretsizdir, gecikme uyarısı çıkmaz.
   * Açıldığı gün (liveSince) mevcut işletmelerin ücretsiz deneme süresi başlar.
   */
  "billing.status": { enabled: false, liveSince: null as string | null },
  /** İlk N işletmeye uzun ücretsiz deneme (kampanya). */
  "billing.earlyAdopter": { limit: 20, trialMonths: 3 },
  /** Kampanya dışındaki işletmelerin ücretsiz deneme süresi (ay). */
  "billing.defaultTrialMonths": 1,
  /** Ödeme gecikmesinin kaçıncı gününde işletme otomatik askıya alınır. */
  "billing.graceDays": 7,
  /** İşletmelerin ve müşterilerin platforma ulaşacağı iletişim bilgileri; alertEmail: yönetici bildirimlerinin gideceği adres (boşsa tüm yöneticiler). */
  /** Havale/EFT ile ödeme seçen işletmelere gösterilecek banka bilgileri. */
  "billing.bankTransfer": { bankName: "" as string, accountName: "" as string, iban: "" as string },
  /** Müşteriye gösterilen yasal metinler (admin düzenler). */
  "legal.customerPrivacy": "" as string,
  "legal.terms": "" as string,
  "platform.contact": { email: "" as string, phone: "" as string, alertEmail: "" as string },
} as const satisfies Record<string, unknown>;

export type PlatformSettingKey = keyof typeof DEFAULT_PLATFORM_SETTINGS;
