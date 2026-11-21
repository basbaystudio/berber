import "server-only";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businesses, contractAcceptances, contractVersions, contracts } from "@/server/db/schema";
import { AppError, notFound, pgErrorCode, PG } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { sendEmail } from "@/server/notifications/mailer";
import { pushInbox } from "@/server/modules/business/inbox";
import { latestVersions } from "@/server/modules/business/contracts";
import { optionalText, trimmed } from "@/lib/validation/common";

type Actor = { adminId: string; ip?: string | null };

export const newContractSchema = z.object({
  title: trimmed(3, 120, "Sözleşme adı"),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/, "Kod yalnızca küçük harf, rakam ve tire içerebilir (örn. hizmet-sozlesmesi)."),
});

export const versionSchema = z.object({
  content: z.string({ error: "Sözleşme metni gerekli." }).trim().min(50, "Sözleşme metni en az 50 karakter olmalı.").max(100_000),
  changeNote: optionalText(300, "Değişiklik notu"),
});

export async function listContractsWithStats(db: Executor) {
  const all = await db.select().from(contracts).orderBy(asc(contracts.title));
  const latest = await latestVersions(db);
  const [{ n: total }] = (await db.select({ n: count() }).from(businesses).where(ne(businesses.status, "SUSPENDED"))) as [{ n: number }];
  const out = [];
  for (const c of all) {
    const v = latest.find((x) => x.contract_id === c.id) ?? null;
    let accepted = 0;
    if (v) {
      const [{ n }] = (await db.select({ n: count() }).from(contractAcceptances).where(eq(contractAcceptances.versionId, v.id))) as [{ n: number }];
      accepted = n;
    }
    out.push({ ...c, latest: v, accepted, totalBusinesses: total });
  }
  return out;
}

export async function createContract(db: DB, actor: Actor, input: z.infer<typeof newContractSchema>) {
  try {
    const [c] = await db.insert(contracts).values(input).returning();
    await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "contract.create", entityId: c!.id, ip: actor.ip });
    return c!;
  } catch (e) {
    if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw new AppError("CONFLICT", "Bu kod kullanılıyor.", { code: "Bu kod kullanılıyor." });
    throw e;
  }
}

/**
 * Yeni sürüm yayınlar. Askıda olmayan tüm işletmelerin bildirim kutusuna ve e-postasına
 * "sözleşme güncellendi, göz atıp onaylayın" bildirimi gider.
 */
export async function publishVersion(db: DB, actor: Actor, contractId: string, input: z.infer<typeof versionSchema>) {
  const v = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).for("update");
    if (!c) throw notFound("Sözleşme");
    const [{ max }] = (await tx.execute<{ max: number | null }>(sql`SELECT max(version) AS max FROM contract_versions WHERE contract_id = ${contractId}`)).rows as [{ max: number | null }];
    const [v] = await tx
      .insert(contractVersions)
      .values({ contractId, version: (max ?? 0) + 1, content: input.content, changeNote: input.changeNote ?? null, publishedByAdminId: actor.adminId })
      .returning();
    await audit(tx, { actorRealm: "ADMIN", actorId: actor.adminId, action: "contract.publish", entityId: v!.id, meta: { code: c.code, version: v!.version }, ip: actor.ip });
    return { ...v!, title: c.title };
  });

  const targets = await db.select({ id: businesses.id, email: businesses.email }).from(businesses).where(ne(businesses.status, "SUSPENDED"));
  const isUpdate = v.version > 1;
  const title = isUpdate ? `“${v.title}” güncellendi` : `Yeni sözleşme: “${v.title}”`;
  const body = `${isUpdate ? "Sözleşme güncellendi" : "Yeni bir sözleşme yayınlandı"}${v.changeNote ? ` (${v.changeNote})` : ""}. Lütfen göz atıp onaylayın.`;
  for (const t of targets) {
    await pushInbox(db, t.id, { kind: "CONTRACT", title, body, link: "/isletme/panel/sozlesmeler" });
    if (t.email)
      await sendEmail(db, {
        to: t.email,
        subject: `${title} — onayınız gerekiyor`,
        text: `${body}\n\nİşletme panelinizde Sözleşmeler bölümünden inceleyebilirsiniz.`,
        html: `<p style="font-family:Arial,sans-serif;line-height:1.6">${body.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}<br><br>İşletme panelinizde <b>Sözleşmeler</b> bölümünden inceleyebilirsiniz.</p>`,
        template: "contract.published",
        businessId: t.id,
        dedupeKey: `contract:published:${v.id}:${t.id}`,
      });
  }
  return v;
}

/** Bir sürümü kimlerin onayladığı / onaylamadığı. */
export async function versionAcceptance(db: Executor, versionId: string) {
  const rows = await db
    .select({ id: businesses.id, name: businesses.name, acceptedAt: contractAcceptances.acceptedAt, ip: contractAcceptances.ip })
    .from(businesses)
    .leftJoin(contractAcceptances, and(eq(contractAcceptances.businessId, businesses.id), eq(contractAcceptances.versionId, versionId)))
    .where(ne(businesses.status, "SUSPENDED"))
    .orderBy(asc(businesses.name));
  return rows;
}
