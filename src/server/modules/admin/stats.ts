import "server-only";
import { sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { TZ } from "@/lib/time";

export type PlatformStats = {
  businesses: { total: number; active: number; suspended: number; draft: number; published: number };
  customers: number;
  appointments: { total: number; today: number; thisMonth: number; pending: number };
  revenue: { completedThisMonthKurus: number; subscriptionThisMonthKurus: number };
};

/** Platform özet istatistikleri. Gün/ay sınırları Europe/Istanbul saatine göre hesaplanır. */
export async function getPlatformStats(db: Executor): Promise<PlatformStats> {
  const r = await db.execute<Record<string, number>>(sql`
    WITH bounds AS (
      SELECT (date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AS day_start,
             (date_trunc('month', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AS month_start,
             date_trunc('month', (now() AT TIME ZONE ${TZ}))::date AS month_date
    )
    SELECT
      (SELECT count(*) FROM businesses)::int AS b_total,
      (SELECT count(*) FROM businesses WHERE status = 'ACTIVE')::int AS b_active,
      (SELECT count(*) FROM businesses WHERE status = 'SUSPENDED')::int AS b_suspended,
      (SELECT count(*) FROM businesses WHERE status = 'DRAFT')::int AS b_draft,
      (SELECT count(*) FROM businesses WHERE is_published)::int AS b_published,
      (SELECT count(*) FROM customers WHERE deleted_at IS NULL)::int AS customers,
      (SELECT count(*) FROM appointments)::int AS a_total,
      (SELECT count(*) FROM appointments, bounds WHERE starts_at >= day_start AND starts_at < day_start + interval '1 day')::int AS a_today,
      (SELECT count(*) FROM appointments, bounds WHERE starts_at >= month_start AND starts_at < month_start + interval '1 month')::int AS a_month,
      (SELECT count(*) FROM appointments WHERE status = 'PENDING')::int AS a_pending,
      (SELECT coalesce(sum(total_kurus), 0) FROM appointments, bounds
         WHERE status = 'COMPLETED' AND starts_at >= month_start AND starts_at < month_start + interval '1 month')::bigint AS rev_completed,
      (SELECT coalesce(sum(amount_kurus), 0) FROM subscription_payments, bounds
         WHERE paid_on >= month_date AND paid_on < month_date + interval '1 month')::bigint AS rev_subs
  `);
  const x = r.rows[0]!;
  const n = (k: string) => Number(x[k] ?? 0);
  return {
    businesses: { total: n("b_total"), active: n("b_active"), suspended: n("b_suspended"), draft: n("b_draft"), published: n("b_published") },
    customers: n("customers"),
    appointments: { total: n("a_total"), today: n("a_today"), thisMonth: n("a_month"), pending: n("a_pending") },
    revenue: { completedThisMonthKurus: n("rev_completed"), subscriptionThisMonthKurus: n("rev_subs") },
  };
}
