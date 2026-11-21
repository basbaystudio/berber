import "server-only";
import type { Executor } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";

export type AuditEntry = {
  actorRealm?: "CUSTOMER" | "BUSINESS" | "ADMIN" | null;
  actorId?: string | null;
  businessId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
};

export async function audit(db: Executor, entry: AuditEntry) {
  await db.insert(auditLogs).values({
    actorRealm: entry.actorRealm ?? null,
    actorId: entry.actorId ?? null,
    businessId: entry.businessId ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    meta: entry.meta,
    ip: entry.ip ?? null,
  });
}
