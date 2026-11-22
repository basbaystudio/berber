import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { businessDocuments, businessHours, businesses, documentTypes, services, staff } from "@/server/db/schema";
import { pendingContractVersions } from "./contracts";
import { notFound } from "@/server/lib/errors";

/**
 * required: yayına almayı engeller (profil gerçekten randevu alabilmeli).
 * required=false: bilgi amaçlı; işletmenin panelinde eksik olarak görünür, yönetici yine de yayına alabilir.
 */
export type PublishCheck = { key: string; label: string; ok: boolean; required: boolean };

/** Yayına alma ön koşulları: profil gerçekten randevu alabilecek durumda olmalı. */
export async function getPublishChecklist(db: Executor, businessId: string): Promise<PublishCheck[]> {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!b) throw notFound("İşletme");
  // Transaction içinde de çağrıldığı için sorgular sıralı çalışır (tek bağlantıda paralel sorgu yapılmaz).
  const [hours] = await db.select({ n: count() }).from(businessHours).where(eq(businessHours.businessId, businessId));
  const [activeStaff] = await db
    .select({ n: count() })
    .from(staff)
    .where(and(eq(staff.businessId, businessId), eq(staff.isActive, true), isNull(staff.deletedAt)));
  const [activeServices] = await db
    .select({ n: count() })
    .from(services)
    .where(and(eq(services.businessId, businessId), eq(services.isActive, true), isNull(services.deletedAt)));
  // Zorunlu yasal belgeler onaylı mı?
  const required = await db.select({ id: documentTypes.id }).from(documentTypes).where(and(eq(documentTypes.isActive, true), eq(documentTypes.isRequired, true)));
  const approved = await db
    .select({ typeId: businessDocuments.typeId })
    .from(businessDocuments)
    .where(and(eq(businessDocuments.businessId, businessId), eq(businessDocuments.status, "APPROVED")));
  const docsOk = required.every((r) => approved.some((a) => a.typeId === r.id));
  const contractsOk = (await pendingContractVersions(db, businessId)).length === 0;
  return [
    { key: "active", required: true, label: "İşletme aktif durumda", ok: b.status === "ACTIVE" },
    { key: "location", required: true, label: "Harita konumu girilmiş", ok: b.latitude !== null && b.longitude !== null },
    { key: "hours", required: true, label: "Çalışma saatleri tanımlanmış", ok: (hours?.n ?? 0) > 0 },
    { key: "staff", required: true, label: "En az bir aktif çalışan var", ok: (activeStaff?.n ?? 0) > 0 },
    { key: "services", required: true, label: "En az bir aktif hizmet var", ok: (activeServices?.n ?? 0) > 0 },
    { key: "documents", required: false, label: "Zorunlu belgeler onaylandı", ok: docsOk },
    { key: "contracts", required: true, label: "Güncel sözleşmeler onaylandı", ok: contractsOk },
  ];
}

