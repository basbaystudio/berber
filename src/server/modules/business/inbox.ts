import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { businessInbox } from "@/server/db/schema";

export type InboxKind = "CONTRACT" | "DOCUMENT" | "INVOICE" | "BILLING" | "GENERAL";

/** İşletmenin bildirim kutusuna kayıt ekler. */
export async function pushInbox(db: Executor, businessId: string, n: { kind: InboxKind; title: string; body?: string; link?: string }) {
  await db.insert(businessInbox).values({ businessId, kind: n.kind, title: n.title, body: n.body ?? null, link: n.link ?? null });
}

export async function unreadCount(db: Executor, businessId: string) {
  const [r] = await db.select({ n: count() }).from(businessInbox).where(and(eq(businessInbox.businessId, businessId), isNull(businessInbox.readAt)));
  return r?.n ?? 0;
}

export function listInbox(db: Executor, businessId: string, limit = 50) {
  return db.select().from(businessInbox).where(eq(businessInbox.businessId, businessId)).orderBy(desc(businessInbox.createdAt)).limit(limit);
}

/** Yalnızca kendi bildirimlerini okundu işaretleyebilir. */
export async function markRead(db: Executor, businessId: string, id?: string) {
  const conds = [eq(businessInbox.businessId, businessId), isNull(businessInbox.readAt)];
  if (id) conds.push(eq(businessInbox.id, id));
  await db.update(businessInbox).set({ readAt: new Date() }).where(and(...conds));
}
