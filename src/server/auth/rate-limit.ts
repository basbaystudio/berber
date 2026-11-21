import "server-only";
import { sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";

export type RateLimitRule = { limit: number; windowSec: number };

/** Kural adları → varsayılan limitler */
export const RATE_LIMITS = {
  loginIp: { limit: 20, windowSec: 15 * 60 },
  loginAccount: { limit: 5, windowSec: 15 * 60 },
  register: { limit: 5, windowSec: 60 * 60 },
  passwordReset: { limit: 5, windowSec: 60 * 60 },
  booking: { limit: 10, windowSec: 10 * 60 },
  upload: { limit: 60, windowSec: 60 * 60 },
  adminWrite: { limit: 300, windowSec: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Sabit pencereli sayaç (PostgreSQL, atomik upsert). Redis gerektirmez; Vercel + Neon üzerinde çalışır.
 * Dönen değer: { allowed, remaining, retryAfterSec }
 */
export async function hit(db: Executor, key: string, rule: RateLimitRule) {
  const res = await db.execute<{ count: number; window_ends_at: Date }>(sql`
    INSERT INTO rate_limits (key, count, window_ends_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${rule.windowSec}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_ends_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      window_ends_at = CASE WHEN rate_limits.window_ends_at <= now()
                            THEN now() + make_interval(secs => ${rule.windowSec})
                            ELSE rate_limits.window_ends_at END
    RETURNING count, window_ends_at`);
  const row = res.rows[0]!;
  const retryAfterSec = Math.max(1, Math.ceil((new Date(row.window_ends_at).getTime() - Date.now()) / 1000));
  return { allowed: row.count <= rule.limit, remaining: Math.max(0, rule.limit - row.count), retryAfterSec };
}

/** Limit aşılırsa AppError(RATE_LIMITED) fırlatır. */
export async function enforce(db: Executor, key: string, rule: RateLimitRule) {
  const r = await hit(db, key, rule);
  if (!r.allowed) {
    const minutes = Math.ceil(r.retryAfterSec / 60);
    throw new AppError("RATE_LIMITED", `Çok fazla deneme yapıldı. Lütfen ${minutes} dakika sonra tekrar deneyin.`);
  }
  return r;
}

export async function resetLimit(db: Executor, key: string) {
  await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
}

export async function purgeExpiredLimits(db: Executor) {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_ends_at < now()`);
}
