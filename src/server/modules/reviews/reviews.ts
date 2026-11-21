import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { appointments, businessTrustScores, businesses, customers, monthlyAwards, reviewReports, reviews, staff } from "@/server/db/schema";
import { AppError, notFound, pgErrorCode, PG } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { pushInbox } from "@/server/modules/business/inbox";
import { getSetting } from "@/server/modules/platform/settings";
import { sendEmail } from "@/server/notifications/mailer";
import { minuteToDate } from "@/lib/availability";
import type { Biz } from "@/server/modules/business/context";
import { bizAudit } from "@/server/modules/business/context";

export const reviewSchema = z.object({
  rating: z.coerce.number({ error: "Puan seçin." }).int().min(1, "Puan seçin.").max(5),
  comment: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(1000, "Yorum en fazla 1000 karakter olabilir.").optional()),
});

/** İşletmenin puan ortalaması yalnızca görünür yorumlardan hesaplanır. */
export async function recalcRating(db: Executor, businessId: string) {
  await db.execute(sql`
    UPDATE businesses SET
      rating_avg = coalesce((SELECT round(avg(rating)::numeric, 2) FROM reviews WHERE business_id = ${businessId} AND status = 'VISIBLE'), 0),
      rating_count = (SELECT count(*) FROM reviews WHERE business_id = ${businessId} AND status = 'VISIBLE')
    WHERE id = ${businessId}`);
}

/** Müşteri yorumu: yalnızca kendi TAMAMLANMIŞ randevusu için, randevu başına bir kez, 60 gün içinde. */
export async function createReview(db: DB, customerId: string, appointmentId: string, input: z.infer<typeof reviewSchema>) {
  const [a] = await db.select().from(appointments).where(and(eq(appointments.id, appointmentId), eq(appointments.customerId, customerId)));
  if (!a) throw notFound("Randevu");
  if (a.status !== "COMPLETED") throw new AppError("VALIDATION", "Yalnızca tamamlanmış randevular için yorum yapılabilir.");
  if (Date.now() - a.startsAt.getTime() > 60 * 86_400_000) throw new AppError("VALIDATION", "Yorum süresi doldu (randevudan sonra 60 gün).");
  try {
    await db.transaction(async (tx) => {
      const [r] = await tx
        .insert(reviews)
        .values({ businessId: a.businessId, appointmentId: a.id, customerId, staffId: a.staffId, rating: input.rating, comment: input.comment ?? null })
        .returning();
      await recalcRating(tx, a.businessId);
      await pushInbox(tx, a.businessId, { kind: "GENERAL", title: `Yeni yorum: ${"★".repeat(input.rating)}`, body: input.comment?.slice(0, 140), link: "/isletme/panel/yorumlar" });
      await audit(tx, { actorRealm: "CUSTOMER", actorId: customerId, businessId: a.businessId, action: "review.create", entity: "review", entityId: r!.id });
    });
  } catch (e) {
    if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw new AppError("CONFLICT", "Bu randevu için zaten yorum yaptınız.");
    throw e;
  }
}

/* ───────── İşletme ───────── */

export async function listBusinessReviews(db: Executor, businessId: string) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      reply: reviews.businessReply,
      status: reviews.status,
      createdAt: reviews.createdAt,
      customerName: customers.name,
      staffName: staff.name,
      openReport: sql<boolean>`EXISTS (SELECT 1 FROM ${reviewReports} WHERE ${reviewReports.reviewId} = ${reviews.id} AND ${reviewReports.status} = 'OPEN')`,
    })
    .from(reviews)
    .leftJoin(customers, eq(customers.id, reviews.customerId))
    .leftJoin(staff, eq(staff.id, reviews.staffId))
    .where(eq(reviews.businessId, businessId))
    .orderBy(desc(reviews.createdAt))
    .limit(200);
}

export const replySchema = z.object({ reply: z.string().trim().min(2, "Yanıt en az 2 karakter olmalı.").max(1000) });

/** İşletme yanıtı (gizleme/silme yetkisi yoktur). */
export async function replyToReview(db: DB, biz: Biz, reviewId: string, reply: string) {
  const r = await db
    .update(reviews)
    .set({ businessReply: reply, repliedAt: new Date() })
    .where(and(eq(reviews.id, reviewId), eq(reviews.businessId, biz.businessId)))
    .returning({ id: reviews.id });
  if (!r.length) throw notFound("Yorum");
  await audit(db, { ...bizAudit(biz), action: "review.reply", entity: "review", entityId: reviewId });
}

export const reportSchema = z.object({
  reason: z.enum(["SPAM", "INSULT", "MISLEADING", "OTHER"], { error: "Şikâyet nedeni seçin." }),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(500).optional()),
});

/** Şikâyet: admin incelemesine gider (yorum başına tek açık şikâyet). */
export async function reportReview(db: DB, biz: Biz, reviewId: string, input: z.infer<typeof reportSchema>) {
  const [r] = await db.select().from(reviews).where(and(eq(reviews.id, reviewId), eq(reviews.businessId, biz.businessId)));
  if (!r) throw notFound("Yorum");
  if (r.status !== "VISIBLE") throw new AppError("CONFLICT", "Bu yorum zaten kaldırılmış.");
  try {
    await db.insert(reviewReports).values({ reviewId, businessId: biz.businessId, reason: input.reason, note: input.note ?? null });
  } catch (e) {
    if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw new AppError("CONFLICT", "Bu yorum için açık bir şikâyetiniz zaten var.");
    throw e;
  }
  await audit(db, { ...bizAudit(biz), action: "review.report", entity: "review", entityId: reviewId });
}

/* ───────── Admin: şikâyet moderasyonu ───────── */

export function listReports(db: Executor, status: "OPEN" | "REJECTED" | "REMOVED" = "OPEN") {
  return db
    .select({
      id: reviewReports.id,
      reason: reviewReports.reason,
      note: reviewReports.note,
      createdAt: reviewReports.createdAt,
      reviewId: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      reply: reviews.businessReply,
      reviewCreatedAt: reviews.createdAt,
      businessId: businesses.id,
      businessName: businesses.name,
      customerName: customers.name,
    })
    .from(reviewReports)
    .innerJoin(reviews, eq(reviews.id, reviewReports.reviewId))
    .innerJoin(businesses, eq(businesses.id, reviewReports.businessId))
    .leftJoin(customers, eq(customers.id, reviews.customerId))
    .where(eq(reviewReports.status, status))
    .orderBy(reviewReports.createdAt);
}

export const resolveSchema = z.object({
  decision: z.enum(["REMOVE", "REJECT"]),
  adminNote: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(500).optional()),
});

/** Admin kararı: yorumu kaldır (puan ortalamasından düşer) ya da şikâyeti reddet. Sonuç işletmeye bildirilir. */
export async function resolveReport(db: DB, actor: { adminId: string; ip?: string | null }, reportId: string, input: z.infer<typeof resolveSchema>) {
  await db.transaction(async (tx) => {
    const [rep] = await tx.select().from(reviewReports).where(eq(reviewReports.id, reportId)).for("update");
    if (!rep) throw notFound("Şikâyet");
    if (rep.status !== "OPEN") throw new AppError("CONFLICT", "Bu şikâyet zaten sonuçlandırılmış.");
    const status = input.decision === "REMOVE" ? "REMOVED" : "REJECTED";
    await tx.update(reviewReports).set({ status, resolvedByAdminId: actor.adminId, resolvedAt: new Date(), adminNote: input.adminNote ?? null }).where(eq(reviewReports.id, reportId));
    if (input.decision === "REMOVE") {
      await tx
        .update(reviews)
        .set({ status: "REMOVED", removedByAdminId: actor.adminId, removedAt: new Date(), removalReason: input.adminNote ?? rep.reason })
        .where(eq(reviews.id, rep.reviewId));
      await recalcRating(tx, rep.businessId);
    }
    await pushInbox(tx, rep.businessId, {
      kind: "GENERAL",
      title: input.decision === "REMOVE" ? "Şikâyet ettiğiniz yorum kaldırıldı" : "Yorum şikâyetiniz reddedildi",
      body: input.adminNote,
      link: "/isletme/panel/yorumlar",
    });
    await audit(tx, { actorRealm: "ADMIN", actorId: actor.adminId, businessId: rep.businessId, action: input.decision === "REMOVE" ? "review.remove" : "review.report_reject", entity: "review", entityId: rep.reviewId, ip: actor.ip });
  });
}

/* ───────── Ayın İşletmesi ───────── */

/**
 * Aylık sıralama: ay içinde (Türkiye saati) en az `awards.minReviews` görünür yorum almış, aktif ve yayında,
 * güven puanı vitrin eşiğinin üzerindeki işletmeler. Ağırlıklı ortalama: (ort·n + 4·10) / (n + 10).
 */
export async function monthlyRanking(db: Executor, month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError("VALIDATION", "Geçersiz ay.");
  const [minReviews, threshold] = [await getSetting(db, "awards.minReviews"), await getSetting(db, "trust.showcaseThreshold")];
  const from = minuteToDate(`${month}-01`, 0);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const to = minuteToDate(`${next}-01`, 0);
  const r = await db.execute<{ business_id: string; name: string; slug: string; n: number; avg: string; weighted: string; trust: string | null }>(sql`
    SELECT b.id AS business_id, b.name, b.slug, count(r.*)::int AS n, round(avg(r.rating)::numeric, 2) AS avg,
           round(((avg(r.rating) * count(r.*) + 4.0 * 10) / (count(r.*) + 10))::numeric, 3) AS weighted,
           ${businessTrustScores.score} AS trust
      FROM reviews r
      JOIN businesses b ON b.id = r.business_id
      LEFT JOIN business_trust_scores ON business_trust_scores.business_id = b.id
     WHERE r.status = 'VISIBLE' AND r.created_at >= ${from} AND r.created_at < ${to}
       AND b.status = 'ACTIVE' AND b.is_published
     GROUP BY b.id, b.name, b.slug, ${businessTrustScores.score}
    HAVING count(r.*) >= ${minReviews}
     ORDER BY weighted DESC, n DESC`);
  const [award] = await db.select().from(monthlyAwards).where(eq(monthlyAwards.month, month));
  return {
    month,
    minReviews,
    threshold,
    award: award ?? null,
    rows: r.rows.map((x) => ({
      businessId: x.business_id,
      name: x.name,
      slug: x.slug,
      reviewCount: Number(x.n),
      avg: Number(x.avg),
      weighted: Number(x.weighted),
      trust: x.trust == null ? 70 : Number(x.trust),
      eligible: (x.trust == null ? 70 : Number(x.trust)) >= threshold,
    })),
  };
}

/** Admin onayıyla ödül verilir (ay başına bir kazanan). İşletmeye bildirim + e-posta. */
export async function awardMonth(db: DB, actor: { adminId: string; ip?: string | null }, month: string, businessId: string) {
  const ranking = await monthlyRanking(db, month);
  const row = ranking.rows.find((r) => r.businessId === businessId);
  if (!row) throw new AppError("VALIDATION", `Bu işletme ${month} ayı için şartları sağlamıyor (en az ${ranking.minReviews} yorum).`);
  if (!row.eligible) throw new AppError("VALIDATION", "Güven puanı eşiğin altında olan işletme ödül alamaz.");
  try {
    await db.insert(monthlyAwards).values({ month, businessId, ratingAvg: String(row.avg), reviewCount: row.reviewCount, awardedByAdminId: actor.adminId });
  } catch (e) {
    if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw new AppError("CONFLICT", "Bu ayın ödülü zaten verildi.");
    throw e;
  }
  const label = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  await pushInbox(db, businessId, { kind: "GENERAL", title: `Tebrikler! ${label} Ayın İşletmesi seçildiniz`, body: "Profilinizde rozetiniz görünüyor.", link: "/isletme/panel" });
  const [b] = await db.select({ email: businesses.email, name: businesses.name }).from(businesses).where(eq(businesses.id, businessId));
  if (b?.email)
    await sendEmail(db, {
      to: b.email,
      subject: `${label} Ayın İşletmesi seçildiniz`,
      text: `Tebrikler ${b.name}! Müşteri yorumlarınızla ${label} Ayın İşletmesi seçildiniz. Profilinizde rozetiniz görünüyor.`,
      html: `<p style="font-family:Arial,sans-serif;line-height:1.6">Tebrikler <b>${b.name.replace(/[&<>]/g, "")}</b>! Müşteri yorumlarınızla <b>${label}</b> Ayın İşletmesi seçildiniz. Profilinizde rozetiniz görünüyor.</p>`,
      template: "award.monthly",
      businessId,
      dedupeKey: `award:${month}:${businessId}`,
    });
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, businessId, action: "award.monthly", meta: { month }, ip: actor.ip });
}
