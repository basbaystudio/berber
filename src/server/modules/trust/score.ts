import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { businessTrustHistory, businessTrustScores, businesses } from "@/server/db/schema";
import { getSetting } from "@/server/modules/platform/settings";
import { trustReasons, trustScore, type TrustRaw } from "@/lib/trust";
import { todayTR } from "@/lib/dates";

/** Son 30 günün davranış verileri. */
export async function loadTrustRaw(db: Executor, businessId: string, now = new Date()): Promise<TrustRaw> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const r = await db.execute<Record<string, string | number | null>>(sql`
    WITH a AS (SELECT * FROM appointments WHERE business_id = ${businessId} AND created_at >= ${since})
    SELECT
      count(*) FILTER (WHERE source = 'ONLINE' AND (confirmed_at IS NOT NULL OR (cancel_reason = 'BUSINESS' AND confirmed_at IS NULL)))::int AS decided,
      count(*) FILTER (WHERE source = 'ONLINE' AND cancel_reason = 'NOT_CONFIRMED_IN_TIME')::int AS expired,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN cancel_reason = 'NOT_CONFIRMED_IN_TIME' THEN 360
                                                       ELSE extract(epoch FROM (coalesce(confirmed_at, cancelled_at) - created_at)) / 60 END)
        FILTER (WHERE source = 'ONLINE' AND (confirmed_at IS NOT NULL OR cancel_reason IN ('BUSINESS', 'NOT_CONFIRMED_IN_TIME'))) AS median_min,
      count(*) FILTER (WHERE confirmed_at IS NOT NULL)::int AS confirmed,
      count(*) FILTER (WHERE confirmed_at IS NOT NULL AND cancel_reason = 'BUSINESS')::int AS cancelled_after_confirm,
      count(*) FILTER (WHERE status IN ('COMPLETED','NO_SHOW') AND ends_at < ${now})::int AS resolved,
      count(*) FILTER (WHERE status = 'CONFIRMED' AND ends_at < ${dayAgo})::int AS unresolved
    FROM a`);
  const x = r.rows[0]!;
  const [b] = await db.select({ last: businesses.lastPanelActivityAt }).from(businesses).where(eq(businesses.id, businessId));
  return {
    decided: Number(x.decided),
    expired: Number(x.expired),
    medianResponseMin: x.median_min == null ? null : Number(x.median_min),
    confirmed: Number(x.confirmed),
    cancelledAfterConfirm: Number(x.cancelled_after_confirm),
    resolved: Number(x.resolved),
    unresolved: Number(x.unresolved),
    daysSinceActivity: b?.last ? Math.floor((now.getTime() - b.last.getTime()) / 86_400_000) : null,
  };
}

/** Güven puanını hesaplar ve kaydeder (randevu olaylarından sonra ve günlük görevde). */
export async function recomputeTrust(db: Executor, businessId: string, opts: { history?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const [raw, weights, prior] = [await loadTrustRaw(db, businessId, now), await getSetting(db, "trust.weights"), await getSetting(db, "trust.prior")];
  const { score, components } = trustScore(raw, weights, prior);
  const sampleSize = raw.decided + raw.expired + raw.confirmed;
  const payload = { ...components, raw } as Record<string, unknown>;
  await db
    .insert(businessTrustScores)
    .values({ businessId, score: String(score), sampleSize, components: payload, computedAt: now })
    .onConflictDoUpdate({ target: businessTrustScores.businessId, set: { score: String(score), sampleSize, components: payload, computedAt: now } });
  if (opts.history)
    await db
      .insert(businessTrustHistory)
      .values({ businessId, score: String(score), components: payload, computedOn: todayTR(now) })
      .onConflictDoUpdate({ target: [businessTrustHistory.businessId, businessTrustHistory.computedOn], set: { score: String(score), components: payload } });
  return { score, raw };
}

export async function recomputeAllTrust(db: Executor) {
  const list = await db.select({ id: businesses.id }).from(businesses).where(sql`${businesses.status} <> 'DRAFT'`);
  for (const b of list) await recomputeTrust(db, b.id, { history: true });
  return list.length;
}

/** Panel/admin gösterimi: kayıtlı puan + gerekçeler (kayıt yoksa anında hesaplanır). */
export async function getTrust(db: Executor, businessId: string) {
  const { score, raw } = await recomputeTrust(db, businessId);
  const threshold = await getSetting(db, "trust.showcaseThreshold");
  return { score, reasons: trustReasons(raw), belowThreshold: score < threshold, threshold };
}
