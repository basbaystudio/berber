import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { DB, Executor } from "@/server/db/client";
import { businesses, subscriptionPayments } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { getStorage } from "@/server/storage";
import { deleteStoredImage } from "@/server/storage/images";
import { sendEmail } from "@/server/notifications/mailer";
import { formatTL } from "@/lib/money";
import { formatDateStr } from "@/lib/dates";
import { adminAlertRecipients } from "./enforcement";
import { pushInbox } from "@/server/modules/business/inbox";

export const MAX_INVOICE_BYTES = 4 * 1024 * 1024;

/** Gerçek PDF mi? (uzantıya değil içeriğe bakılır) */
export function isPdf(buf: Buffer) {
  return buf.length > 8 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

export async function readInvoiceUpload(value: FormDataEntryValue | null): Promise<{ buffer: Buffer; fileName: string }> {
  if (!value || typeof value === "string" || value.size === 0) throw new AppError("VALIDATION", "PDF dosyası seçin.", { file: "PDF dosyası seçin." });
  if (value.size > MAX_INVOICE_BYTES) throw new AppError("VALIDATION", "Fatura en fazla 4 MB olabilir.", { file: "En fazla 4 MB." });
  const buffer = Buffer.from(await value.arrayBuffer());
  if (!isPdf(buffer)) throw new AppError("VALIDATION", "Yalnızca PDF dosyası yüklenebilir.", { file: "Yalnızca PDF." });
  const fileName = value.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "fatura.pdf";
  return { buffer, fileName: fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf` };
}

/** Ödemeye PDF fatura yükler (varsa eskisinin yerine geçer). Yalnızca admin. */
export async function uploadInvoice(db: DB, actor: { adminId: string; ip?: string | null }, paymentId: string, file: { buffer: Buffer; fileName: string }) {
  const [p] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, paymentId));
  if (!p) throw notFound("Ödeme");
  // Tahmin edilemez anahtar; dosya yalnızca yetkili indirme adresi üzerinden sunulur.
  const key = `invoices/${p.businessId}/${randomBytes(16).toString("hex")}.pdf`;
  const stored = await getStorage().put(key, file.buffer, "application/pdf");
  await db
    .update(subscriptionPayments)
    .set({ invoiceKey: stored.key, invoiceUrl: stored.url, invoiceFileName: file.fileName, invoiceUploadedAt: new Date() })
    .where(eq(subscriptionPayments.id, paymentId));
  if (p.invoiceKey && p.invoiceUrl) await deleteStoredImage({ key: p.invoiceKey, url: p.invoiceUrl });
  await pushInbox(db, p.businessId, {
    kind: "INVOICE",
    title: "Faturanız yüklendi",
    body: `${formatTL(p.amountKurus)} tutarındaki ödemenizin faturası (${formatDateStr(p.coversFrom)} – ${formatDateStr(p.coversTo)}) hazır.`,
    link: "/isletme/panel/abonelik",
  });
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, businessId: p.businessId, action: "subscription.invoice_upload", entity: "payment", entityId: paymentId, ip: actor.ip });
}

/**
 * Fatura dosyasını okur. `businessId` verilirse (işletme paneli) yalnızca o işletmenin ödemesi döner;
 * başka işletmenin faturası için NOT_FOUND.
 */
export async function getInvoiceFile(db: Executor, paymentId: string, scope: { businessId?: string }) {
  const conds = [eq(subscriptionPayments.id, paymentId)];
  if (scope.businessId) conds.push(eq(subscriptionPayments.businessId, scope.businessId));
  const [p] = await db.select().from(subscriptionPayments).where(and(...conds));
  if (!p || !p.invoiceKey || !p.invoiceUrl) throw notFound("Fatura");
  const buffer = await getStorage().get({ key: p.invoiceKey, url: p.invoiceUrl });
  return { buffer, fileName: p.invoiceFileName ?? "fatura.pdf" };
}

/** Faturası henüz yüklenmemiş ödemeler (admin). */
export function listPendingInvoices(db: Executor) {
  return db
    .select({ p: subscriptionPayments, businessName: businesses.name })
    .from(subscriptionPayments)
    .innerJoin(businesses, eq(businesses.id, subscriptionPayments.businessId))
    .where(and(isNull(subscriptionPayments.invoiceKey), eq(subscriptionPayments.status, "SUCCEEDED")))
    .orderBy(asc(subscriptionPayments.paidAt));
}

/** Otomatik (kartla) alınan her ödemede yöneticiye "ödeme alındı, fatura yükleyin" e-postası. */
export async function notifyAdminPaymentReceived(db: Executor, paymentId: string) {
  const [row] = await db
    .select({ p: subscriptionPayments, name: businesses.name })
    .from(subscriptionPayments)
    .innerJoin(businesses, eq(businesses.id, subscriptionPayments.businessId))
    .where(eq(subscriptionPayments.id, paymentId));
  if (!row) return;
  const lines = [
    `${row.name} işletmesinden ${formatTL(row.p.amountKurus)} ödeme alındı (${row.p.months} ay, ${formatDateStr(row.p.coversFrom)} – ${formatDateStr(row.p.coversTo)}).`,
    "Lütfen bu ödemenin faturasını yönetim panelinden (Abonelikler → Faturası bekleyen ödemeler) PDF olarak yükleyin. Yüklediğiniz fatura işletmenin panelinde görünecektir.",
  ];
  const html = `<!doctype html><html lang="tr"><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#292524;background:#fafaf9;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:28px"><h1 style="font-size:18px;margin:0 0 16px">Ödeme alındı — fatura bekleniyor</h1>${lines
    .map((l) => `<p style="line-height:1.6;margin:0 0 12px">${l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>`)
    .join("")}</div></body></html>`;
  for (const to of await adminAlertRecipients(db)) {
    await sendEmail(db, {
      to,
      subject: `Ödeme alındı: ${row.name} — fatura yükleyin`,
      text: lines.join("\n\n"),
      html,
      template: "billing.payment_received.admin",
      businessId: row.p.businessId,
      dedupeKey: `billing:payment_received:${paymentId}:${to}`,
    });
  }
}
