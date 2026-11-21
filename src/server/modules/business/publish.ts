import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { businessHours, businesses, services, staff } from "@/server/db/schema";
import { notFound } from "@/server/lib/errors";

export type PublishCheck = { key: string; label: string; ok: boolean };

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
  return [
    { key: "active", label: "İşletme aktif durumda", ok: b.status === "ACTIVE" },
    { key: "location", label: "Harita konumu girilmiş", ok: b.latitude !== null && b.longitude !== null },
    { key: "hours", label: "Çalışma saatleri tanımlanmış", ok: (hours?.n ?? 0) > 0 },
    { key: "staff", label: "En az bir aktif çalışan var", ok: (activeStaff?.n ?? 0) > 0 },
    { key: "services", label: "En az bir aktif hizmet var", ok: (activeServices?.n ?? 0) > 0 },
  ];
}

