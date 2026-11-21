import "server-only";
import { count, desc, eq } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { auditLogs, businesses } from "@/server/db/schema";

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditLogs(db: Executor, page = 1) {
  const p = Math.max(1, page);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorRealm: auditLogs.actorRealm,
        actorId: auditLogs.actorId,
        businessId: auditLogs.businessId,
        businessName: businesses.name,
        entity: auditLogs.entity,
        meta: auditLogs.meta,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(businesses, eq(businesses.id, auditLogs.businessId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((p - 1) * AUDIT_PAGE_SIZE),
    db.select({ n: count() }).from(auditLogs),
  ]);
  return { rows, total: total?.n ?? 0, page: p, pageSize: AUDIT_PAGE_SIZE };
}

/** Denetim kaydı eylem kodlarının Türkçe karşılıkları */
export const AUDIT_LABELS: Record<string, string> = {
  "auth.login": "Giriş yaptı",
  "auth.login_failed": "Başarısız giriş denemesi",
  "auth.logout": "Çıkış yaptı",
  "auth.password_changed": "Şifresini değiştirdi",
  "business.create": "İşletme oluşturuldu",
  "business.update": "İşletme bilgileri güncellendi",
  "business.activate": "İşletme aktifleştirildi",
  "business.suspend": "İşletme askıya alındı",
  "business.publish": "İşletme yayına alındı",
  "business.unpublish": "İşletme yayından kaldırıldı",
  "business.feature": "Öne çıkanlara eklendi",
  "business.unfeature": "Öne çıkanlardan çıkarıldı",
  "business_user.reset_password": "İşletme şifresi sıfırlandı",
  "business_user.update": "İşletme hesabı güncellendi",
  "service_type.create": "Hizmet türü eklendi",
  "service_type.update": "Hizmet türü güncellendi",
};
