import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import sharp from "sharp";
import type { DB, Executor } from "@/server/db/client";
import { businessDocuments, businesses, documentTypes } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { getStorage } from "@/server/storage";
import { deleteStoredImage } from "@/server/storage/images";
import { sendEmail } from "@/server/notifications/mailer";
import { adminAlertRecipients } from "@/server/modules/billing/enforcement";
import { bizAudit, type Biz } from "./context";

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

type Kind = { mime: string; ext: string };
/** Gerçek dosya türü (içerikten): PDF, JPEG, PNG. */
export function sniffDocument(buf: Buffer): Kind | null {
  if (buf.length > 8 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  return null;
}

export async function readDocumentUpload(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string" || value.size === 0) throw new AppError("VALIDATION", "Dosya seçin.", { file: "Dosya seçin." });
  if (value.size > MAX_DOCUMENT_BYTES) throw new AppError("VALIDATION", "Dosya en fazla 4 MB olabilir.", { file: "En fazla 4 MB." });
  const buffer = Buffer.from(await value.arrayBuffer());
  const name = value.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "belge";
  return { buffer, fileName: name };
}

/** Belge türleri ve işletmenin her tür için güncel belgesi. */
export async function getMyDocuments(db: Executor, businessId: string) {
  const types = await db.select().from(documentTypes).where(eq(documentTypes.isActive, true)).orderBy(asc(documentTypes.sortOrder), asc(documentTypes.name));
  const docs = await db.select().from(businessDocuments).where(eq(businessDocuments.businessId, businessId));
  return types.map((t) => {
    const d = docs.find((x) => x.typeId === t.id);
    return {
      type: t,
      doc: d ? { id: d.id, fileName: d.fileName, status: d.status as "PENDING" | "APPROVED" | "REJECTED", reviewNote: d.reviewNote, uploadedAt: d.uploadedAt, reviewedAt: d.reviewedAt } : null,
    };
  });
}

/**
 * Belge yükleme/değiştirme. Görseller yeniden kodlanır (konum vb. metadata silinir); PDF olduğu gibi saklanır.
 * Her yükleme yeniden incelemeye (PENDING) düşer ve yöneticiye e-posta gider.
 */
export async function uploadDocument(db: DB, biz: Biz, typeId: string, file: { buffer: Buffer; fileName: string }) {
  const [type] = await db.select().from(documentTypes).where(and(eq(documentTypes.id, typeId), eq(documentTypes.isActive, true)));
  if (!type) throw notFound("Belge türü");
  const kind = sniffDocument(file.buffer);
  if (!kind) throw new AppError("VALIDATION", "Yalnızca PDF, JPEG veya PNG yüklenebilir.", { file: "Desteklenmeyen dosya türü." });
  let body = file.buffer;
  let mime = kind.mime;
  let ext = kind.ext;
  if (kind.mime !== "application/pdf") {
    try {
      body = await sharp(file.buffer, { limitInputPixels: 50_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      mime = "image/jpeg";
      ext = "jpg";
    } catch {
      throw new AppError("VALIDATION", "Görsel okunamadı.", { file: "Görsel okunamadı." });
    }
  }
  const stored = await getStorage().put(`documents/${biz.businessId}/${randomBytes(16).toString("hex")}.${ext}`, body, mime);
  const fileName = file.fileName.replace(/\.[^.]*$/, "") + `.${ext}`;
  const [old] = await db.select().from(businessDocuments).where(and(eq(businessDocuments.businessId, biz.businessId), eq(businessDocuments.typeId, typeId)));
  const values = { fileKey: stored.key, fileUrl: stored.url, fileName, mime, sizeBytes: body.length, status: "PENDING", reviewNote: null, reviewedAt: null, reviewedByAdminId: null, uploadedAt: new Date() };
  const [doc] = await db
    .insert(businessDocuments)
    .values({ businessId: biz.businessId, typeId, ...values })
    .onConflictDoUpdate({ target: [businessDocuments.businessId, businessDocuments.typeId], set: values })
    .returning();
  if (old) await deleteStoredImage({ key: old.fileKey, url: old.fileUrl });
  await audit(db, { ...bizAudit(biz), action: "document.upload", entity: "document", entityId: doc!.id, meta: { type: type.name } });

  const [b] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, biz.businessId));
  const text = `${b?.name} işletmesi "${type.name}" belgesini yükledi. Yönetim panelinden (Belgeler) inceleyip onaylayabilirsiniz.`;
  for (const to of await adminAlertRecipients(db)) {
    await sendEmail(db, {
      to,
      subject: `Yeni belge: ${b?.name} — ${type.name}`,
      text,
      html: `<p style="font-family:Arial,sans-serif;line-height:1.6">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>`,
      template: "document.uploaded.admin",
      businessId: biz.businessId,
      dedupeKey: `document:uploaded:${doc!.id}:${doc!.uploadedAt.getTime()}:${to}`,
    });
  }
  return doc!;
}

/** Belge dosyası. businessId verilirse yalnızca o işletmenin belgesi (aksi halde NOT_FOUND). */
export async function getDocumentFile(db: Executor, id: string, scope: { businessId?: string }) {
  const conds = [eq(businessDocuments.id, id)];
  if (scope.businessId) conds.push(eq(businessDocuments.businessId, scope.businessId));
  const [d] = await db.select().from(businessDocuments).where(and(...conds));
  if (!d) throw notFound("Belge");
  return { buffer: await getStorage().get({ key: d.fileKey, url: d.fileUrl }), fileName: d.fileName, mime: d.mime };
}
