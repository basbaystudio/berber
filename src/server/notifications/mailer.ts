import "server-only";
import { and, eq, lt } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { logger } from "@/server/lib/logger";

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  template: string;
  businessId?: string | null;
  /** Aynı anahtarla ikinci gönderim yapılmaz (tekil bildirim). */
  dedupeKey?: string;
};

type DeliveryResult = { ok: true } | { ok: false; error: string };

/**
 * E-posta sağlayıcısı. RESEND_API_KEY tanımlıysa Resend (ücretsiz katman) kullanılır;
 * değilse (yerel geliştirme/test) e-posta log'a yazılır ve gönderilmiş sayılır.
 */
async function deliver(e: Pick<Email, "to" | "subject" | "text" | "html">): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.info("email_dev_log", { to: e.to, subject: e.subject });
    return { ok: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Berber Randevu <bildirim@example.com>", to: [e.to], subject: e.subject, text: e.text, html: e.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Bildirimi kaydeder ve göndermeyi dener. dedupeKey daha önce kullanıldıysa hiçbir şey yapmaz. */
export async function sendEmail(db: Executor, e: Email): Promise<"sent" | "failed" | "duplicate"> {
  const [row] = await db
    .insert(notifications)
    .values({
      channel: "EMAIL",
      to: e.to,
      template: e.template,
      payload: { subject: e.subject, text: e.text, html: e.html },
      businessId: e.businessId ?? null,
      dedupeKey: e.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id });
  if (!row) return "duplicate";
  const r = await deliver(e);
  await db
    .update(notifications)
    .set(r.ok ? { status: "SENT", sentAt: new Date(), attempts: 1 } : { status: "FAILED", error: r.error, attempts: 1 })
    .where(eq(notifications.id, row.id));
  if (!r.ok) logger.warn("email_failed", { template: e.template, error: r.error });
  return r.ok ? "sent" : "failed";
}

/** Başarısız e-postaları yeniden dener (en fazla 5 deneme). Günlük işte çağrılır. */
export async function retryFailedEmails(db: Executor) {
  const failed = await db.select().from(notifications).where(and(eq(notifications.status, "FAILED"), lt(notifications.attempts, 5))).limit(100);
  let sent = 0;
  for (const n of failed) {
    const p = n.payload as { subject: string; text: string; html: string };
    const r = await deliver({ to: n.to, ...p });
    await db
      .update(notifications)
      .set(r.ok ? { status: "SENT", sentAt: new Date(), attempts: n.attempts + 1, error: null } : { attempts: n.attempts + 1, error: r.error })
      .where(eq(notifications.id, n.id));
    if (r.ok) sent++;
  }
  return { retried: failed.length, sent };
}
