import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businessDocuments, businesses, documentTypes } from "@/server/db/schema";
import { AppError, notFound, pgErrorCode, PG } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { sendEmail } from "@/server/notifications/mailer";
import { pushInbox } from "@/server/modules/business/inbox";
import { checkbox, optionalText, trimmed } from "@/lib/validation/common";

type Actor = { adminId: string; ip?: string | null };

export const documentTypeSchema = z.object({
  name: trimmed(2, 80, "Belge adı"),
  description: optionalText(200, "Açıklama"),
  isRequired: checkbox,
  isActive: checkbox,
  sortOrder: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(999)),
});

export function listDocumentTypes(db: Executor) {
  return db.select().from(documentTypes).orderBy(asc(documentTypes.sortOrder), asc(documentTypes.name));
}

export async function saveDocumentType(db: DB, actor: Actor, id: string | null, input: z.infer<typeof documentTypeSchema>) {
  try {
    if (id) {
      const r = await db.update(documentTypes).set({ ...input, description: input.description ?? null }).where(eq(documentTypes.id, id)).returning({ id: documentTypes.id });
      if (!r.length) throw notFound("Belge türü");
    } else {
      await db.insert(documentTypes).values({ ...input, description: input.description ?? null });
    }
  } catch (e) {
    if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw new AppError("CONFLICT", "Bu isimde bir belge türü zaten var.", { name: "Bu isim kullanılıyor." });
    throw e;
  }
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "document_type.save", entityId: id ?? undefined, ip: actor.ip });
}

/** İnceleme kuyruğu ya da işletmenin tüm belgeleri. */
export function listDocuments(db: Executor, filter: { status?: "PENDING" | "APPROVED" | "REJECTED"; businessId?: string }) {
  const q = db
    .select({ d: businessDocuments, typeName: documentTypes.name, businessName: businesses.name })
    .from(businessDocuments)
    .innerJoin(documentTypes, eq(documentTypes.id, businessDocuments.typeId))
    .innerJoin(businesses, eq(businesses.id, businessDocuments.businessId));
  const where = filter.businessId ? eq(businessDocuments.businessId, filter.businessId) : filter.status ? eq(businessDocuments.status, filter.status) : undefined;
  return (where ? q.where(where) : q).orderBy(asc(businessDocuments.uploadedAt));
}

export const reviewSchema = z
  .object({ decision: z.enum(["APPROVED", "REJECTED"]), note: optionalText(500, "Açıklama") })
  .refine((v) => v.decision === "APPROVED" || !!v.note, { message: "Reddetme nedenini yazın.", path: ["note"] });

/** Belge onayı/reddi; sonuç işletmenin bildirim kutusuna ve e-postasına gider. */
export async function reviewDocument(db: DB, actor: Actor, id: string, input: z.infer<typeof reviewSchema>) {
  const [row] = await db
    .select({ d: businessDocuments, typeName: documentTypes.name, email: businesses.email })
    .from(businessDocuments)
    .innerJoin(documentTypes, eq(documentTypes.id, businessDocuments.typeId))
    .innerJoin(businesses, eq(businesses.id, businessDocuments.businessId))
    .where(eq(businessDocuments.id, id));
  if (!row) throw notFound("Belge");
  await db
    .update(businessDocuments)
    .set({ status: input.decision, reviewNote: input.note ?? null, reviewedAt: new Date(), reviewedByAdminId: actor.adminId })
    .where(eq(businessDocuments.id, id));
  const approved = input.decision === "APPROVED";
  const title = approved ? `"${row.typeName}" belgeniz onaylandı` : `"${row.typeName}" belgeniz reddedildi`;
  const body = approved ? "Belgeniz incelendi ve onaylandı." : `Neden: ${input.note}. Lütfen belgeyi güncelleyip yeniden yükleyin.`;
  await pushInbox(db, row.d.businessId, { kind: "DOCUMENT", title, body, link: "/isletme/panel/belgeler" });
  if (row.email)
    await sendEmail(db, {
      to: row.email,
      subject: title,
      text: body,
      html: `<p style="font-family:Arial,sans-serif;line-height:1.6">${(title + ". " + body).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>`,
      template: `document.${approved ? "approved" : "rejected"}`,
      businessId: row.d.businessId,
      dedupeKey: `document:review:${id}:${Date.now()}`,
    });
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, businessId: row.d.businessId, action: approved ? "document.approve" : "document.reject", entity: "document", entityId: id, ip: actor.ip });
}
