import "server-only";
import { and, eq, lt, ne } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { generateToken, hashToken } from "./tokens";
import { REALMS, type Realm } from "./realms";

export type Session = typeof sessions.$inferSelect;

const TOUCH_INTERVAL_MS = 5 * 60_000;

export async function createSession(
  db: Executor,
  realm: Realm,
  principalId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; session: Session }> {
  const token = generateToken();
  const now = Date.now();
  const [session] = await db
    .insert(sessions)
    .values({
      id: hashToken(token),
      realm,
      principalId,
      expiresAt: new Date(now + REALMS[realm].ttlMs),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    })
    .returning();
  return { token, session: session! };
}

/**
 * Token'ı doğrular. Realm eşleşmesi zorunludur: bir realm'in token'ı başka realm'de geçersizdir.
 * Süresi dolan oturum silinir. Sliding realm'lerde süre uzatılır.
 */
export async function validateSession(db: Executor, realm: Realm, token: string | undefined | null): Promise<Session | null> {
  if (!token || token.length < 32 || token.length > 128) return null;
  const id = hashToken(token);
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.realm, realm))).limit(1);
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    const cfg = REALMS[realm];
    const patch: Partial<Session> = { lastSeenAt: new Date(now) };
    if (cfg.sliding) patch.expiresAt = new Date(now + cfg.ttlMs);
    await db.update(sessions).set(patch).where(eq(sessions.id, id));
    Object.assign(session, patch);
  }
  return session;
}

export async function invalidateSession(db: Executor, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Şifre değişimi / hesap pasifleştirme sonrası tüm oturumları kapatır (isteğe bağlı olarak biri hariç). */
export async function invalidateAllSessions(db: Executor, realm: Realm, principalId: string, exceptSessionId?: string) {
  const conds = [eq(sessions.realm, realm), eq(sessions.principalId, principalId)];
  if (exceptSessionId) conds.push(ne(sessions.id, exceptSessionId));
  const rows = await db.delete(sessions).where(and(...conds)).returning({ id: sessions.id });
  return rows.length;
}

export async function purgeExpiredSessions(db: Executor) {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
