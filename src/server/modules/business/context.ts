/**
 * İşletme paneli işlemlerinin bağlamı. businessId HER ZAMAN oturumdan gelir (requireBusiness),
 * asla istekten alınmaz. Tüm işletme modülü fonksiyonları bu bağlamla sınırlandırılmış sorgu yapar.
 */
export type Biz = { businessId: string; userId: string; ip?: string | null };

export const bizAudit = (biz: Biz) => ({ actorRealm: "BUSINESS" as const, actorId: biz.userId, businessId: biz.businessId, ip: biz.ip ?? null });
