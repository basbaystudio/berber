import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { DB, Executor } from "@/server/db/client";
import { businessSubscriptions, businessUsers, businesses, platformAdmins } from "@/server/db/schema";
import { audit } from "@/server/lib/audit";
import { invalidateAllSessions } from "@/server/auth/session";
import { getSetting } from "@/server/modules/platform/settings";
import { retryFailedEmails, sendEmail } from "@/server/notifications/mailer";
import { pastDueForAdmin, pastDueForBusiness, suspendedForAdmin, suspendedForBusiness } from "@/server/notifications/templates";
import { todayTR } from "@/lib/dates";
import { computeSubscriptionStatus, currentFee } from "./status";

/** Yönetici bildirimlerinin gideceği adresler: ayarlardaki adres, yoksa tüm aktif yöneticiler. */
export async function adminAlertRecipients(db: Executor): Promise<string[]> {
  const contact = await getSetting(db, "platform.contact");
  if (contact.alertEmail) return [contact.alertEmail];
  const admins = await db.select({ email: platformAdmins.email }).from(platformAdmins).where(eq(platformAdmins.isActive, true));
  return admins.map((a) => a.email);
}

export async function contactLine(db: Executor) {
  const c = await getSetting(db, "platform.contact");
  const parts = [c.email && `e-posta: ${c.email}`, c.phone && `telefon: ${c.phone}`].filter(Boolean);
  return parts.length ? `Ödeme ve sorularınız için bize ulaşın (${parts.join(", ")}).` : "Ödeme ve sorularınız için platform yönetimiyle iletişime geçin.";
}

/** Ödeme gecikmesi nedeniyle askıya alır (yayındaysa geri açılınca yeniden yayına alınmak üzere işaretlenir). */
async function suspendForBilling(db: DB, businessId: string) {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update");
    if (!b || b.status !== "ACTIVE") return false;
    await tx
      .update(businesses)
      .set({ status: "SUSPENDED", suspendedReason: "BILLING", republishOnReactivate: b.isPublished, isPublished: false, updatedAt: new Date() })
      .where(eq(businesses.id, businessId));
    const users = await tx.select({ id: businessUsers.id }).from(businessUsers).where(eq(businessUsers.businessId, businessId));
    for (const u of users) await invalidateAllSessions(tx, "BUSINESS", u.id);
    await audit(tx, { businessId, action: "business.suspend_billing", entity: "business", entityId: businessId });
    return true;
  });
}

/**
 * Günlük abonelik kontrolü (Vercel Cron, günde bir kez):
 * - Gecikmenin ilk günü: işletmeye ve yöneticiye e-posta (her gecikme dönemi için bir kez)
 * - Gecikme `graceDays` gününe ulaşınca: otomatik askıya alma + e-posta
 * Ücretlendirme kapalıyken hiçbir şey yapmaz. Tekrar çalıştırılması güvenlidir (idempotent).
 */
export async function runBillingEnforcement(db: DB, now = new Date()) {
  const billing = await getSetting(db, "billing.status");
  const summary = { pastDueNotified: 0, suspended: 0, emailsFailed: 0, skipped: !billing.enabled };
  if (!billing.enabled) return summary;
  const graceDays = await getSetting(db, "billing.graceDays");
  const today = todayTR(now);
  const admins = await adminAlertRecipients(db);
  const line = await contactLine(db);

  const rows = await db
    .select({ sub: businessSubscriptions, b: businesses })
    .from(businessSubscriptions)
    .innerJoin(businesses, eq(businesses.id, businessSubscriptions.businessId))
    .where(and(isNull(businessSubscriptions.cancelledAt), eq(businesses.status, "ACTIVE")));

  for (const { sub, b } of rows) {
    const st = computeSubscriptionStatus(sub, true, today);
    if (st.kind !== "PAST_DUE" || !st.coveredUntil) continue;
    const ctx = { businessName: b.name, coveredUntil: st.coveredUntil, feeKurus: currentFee(sub).kurus, feeUnit: currentFee(sub).unit, graceDays, contactLine: line };
    const recipients = [
      ...(b.email ? [{ to: b.email, kind: "business" as const }] : []),
      ...admins.map((to) => ({ to, kind: "admin" as const })),
    ];

    // 1) İlk gün bildirimi (aynı gecikme dönemi için bir kez)
    let notified = false;
    for (const r of recipients) {
      const t = r.kind === "business" ? pastDueForBusiness(ctx) : pastDueForAdmin(ctx);
      const res = await sendEmail(db, { ...t, to: r.to, template: `billing.past_due.${r.kind}`, businessId: b.id, dedupeKey: `billing:past_due:${b.id}:${st.coveredUntil}:${r.to}` });
      if (res === "sent") notified = true;
      if (res === "failed") summary.emailsFailed++;
    }
    if (notified) summary.pastDueNotified++;

    // 2) Süre dolduysa askıya al
    if ((st.days ?? 0) >= graceDays && (await suspendForBilling(db, b.id))) {
      summary.suspended++;
      for (const r of recipients) {
        const t = r.kind === "business" ? suspendedForBusiness(ctx) : suspendedForAdmin(ctx);
        const res = await sendEmail(db, { ...t, to: r.to, template: `billing.suspended.${r.kind}`, businessId: b.id, dedupeKey: `billing:suspended:${b.id}:${st.coveredUntil}:${r.to}` });
        if (res === "failed") summary.emailsFailed++;
      }
    }
  }
  await retryFailedEmails(db);
  return summary;
}
