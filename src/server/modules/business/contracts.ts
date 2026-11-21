import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import type { DB, Executor } from "@/server/db/client";
import { contractAcceptances, contractVersions, contracts } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { bizAudit, type Biz } from "./context";

/** Her aktif sözleşmenin en güncel sürümü. */
export async function latestVersions(db: Executor) {
  const rows = await db.execute<{ id: string; contract_id: string; version: number; title: string; code: string; content: string; change_note: string | null; published_at: Date }>(sql`
    SELECT DISTINCT ON (v.contract_id) v.id, v.contract_id, v.version, c.title, c.code, v.content, v.change_note, v.published_at
      FROM contract_versions v JOIN contracts c ON c.id = v.contract_id
     WHERE c.is_active
     ORDER BY v.contract_id, v.version DESC`);
  return rows.rows;
}

/** İşletmenin henüz onaylamadığı güncel sözleşme sürümleri. */
export async function pendingContractVersions(db: Executor, businessId: string) {
  const latest = await latestVersions(db);
  if (!latest.length) return [];
  const accepted = await db
    .select({ versionId: contractAcceptances.versionId })
    .from(contractAcceptances)
    .where(eq(contractAcceptances.businessId, businessId));
  const ids = new Set(accepted.map((a) => a.versionId));
  return latest.filter((v) => !ids.has(v.id));
}

/** İşletme paneli: sözleşmeler, güncel sürüm ve onay durumu. */
export async function getMyContracts(db: Executor, businessId: string) {
  const latest = await latestVersions(db);
  const acc = await db.select().from(contractAcceptances).where(eq(contractAcceptances.businessId, businessId));
  return latest
    .map((v) => ({ ...v, acceptedAt: acc.find((a) => a.versionId === v.id)?.acceptedAt ?? null }))
    .sort((a, b) => a.title.localeCompare(b.title, "tr"));
}

/** Sürüm onayı (tarih, IP, tarayıcı kaydıyla). Yalnızca güncel sürüm onaylanabilir; tekrar onay etkisizdir. */
export async function acceptContract(db: DB, biz: Biz, versionId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const latest = await latestVersions(db);
  const v = latest.find((x) => x.id === versionId);
  if (!v) {
    const [exists] = await db.select({ id: contractVersions.id }).from(contractVersions).where(eq(contractVersions.id, versionId));
    if (exists) throw new AppError("CONFLICT", "Bu sözleşmenin daha yeni bir sürümü yayınlandı. Lütfen güncel sürümü inceleyin.");
    throw notFound("Sözleşme");
  }
  await db
    .insert(contractAcceptances)
    .values({ versionId, businessId: biz.businessId, acceptedByUserId: biz.userId, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null })
    .onConflictDoNothing();
  await audit(db, { ...bizAudit(biz), action: "contract.accept", entity: "contract_version", entityId: versionId, meta: { code: v.code, version: v.version } });
}

/** Sözleşme sürüm geçmişi (işletme eski sürümleri de görebilir). */
export async function contractHistory(db: Executor, contractId: string) {
  const [c] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!c) throw notFound("Sözleşme");
  const versions = await db.select().from(contractVersions).where(eq(contractVersions.contractId, contractId)).orderBy(desc(contractVersions.version));
  return { contract: c, versions };
}

