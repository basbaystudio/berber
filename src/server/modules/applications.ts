import "server-only";
import { randomInt } from "node:crypto";
import { and, asc, count, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businessApplications, businessSubscriptions, districts, provinces, subscriptionPlans } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { hit } from "@/server/auth/rate-limit";
import { getSetting } from "@/server/modules/platform/settings";
import { createBusiness, type AdminActor } from "@/server/modules/admin/businesses";
import { adminAlertRecipients } from "@/server/modules/billing/enforcement";
import { sendEmail } from "@/server/notifications/mailer";
import { layout } from "@/server/notifications/templates";
import { checkbox, email, intFromForm, optionalText, trimmed, trPhone } from "@/lib/validation/common";
import { slugify } from "@/lib/slug";
import { formatTrPhone } from "@/lib/phone";
import { siteUrl } from "@/lib/site";

/**
 * İşletme başvurusu: şehir dışındaki berberler de formu doldurup plan seçer. Yönetici onaylayınca işletme ve hesabı
 * oluşturulur; ücretsiz süre (ilk N işletmeye kampanya, sonrakilere standart) ONAY sırasına göre otomatik verilir.
 */
export const applicationSchema = z.object({
  businessName: trimmed(2, 80, "İşletme adı"),
  ownerName: trimmed(2, 80, "Ad soyad"),
  phone: trPhone,
  email,
  provinceId: intFromForm("İl"),
  districtId: intFromForm("İlçe"),
  addressLine: trimmed(5, 300, "Adres"),
  staffCount: z.coerce.number({ error: "Çalışan sayısı girin." }).int("Çalışan sayısı tam sayı olmalı.").min(1, "En az 1 olmalı.").max(100, "En fazla 100."),
  planId: z.string({ error: "Paket seçin." }).uuid("Paket seçin."),
  billingCycle: z.enum(["MONTHLY", "YEARLY"], { error: "Ödeme dönemi seçin." }),
  note: optionalText(500, "Not"),
  kvkk: checkbox.refine((v) => v, "Devam etmek için aydınlatma metnini onaylayın."),
  /** Bot tuzağı: gerçek kullanıcı bu alanı görmez, doldurmaz */
  website: z.string().max(0).optional().or(z.literal("")),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

/** Başvuru sayfasındaki teklif: aktif paketler ve şu an başvurana verilecek ücretsiz süre. */
export async function getApplicationOffer(db: Executor) {
  const plans = await db
    .select({ id: subscriptionPlans.id, name: subscriptionPlans.name, description: subscriptionPlans.description, monthly: subscriptionPlans.monthlyPriceKurus, yearly: subscriptionPlans.yearlyPriceKurus, highlights: subscriptionPlans.highlights, isDefault: subscriptionPlans.isDefault })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.monthlyPriceKurus));
  const early = await getSetting(db, "billing.earlyAdopter");
  const defaultTrial = await getSetting(db, "billing.defaultTrialMonths");
  const [{ n }] = (await db.select({ n: count() }).from(businessSubscriptions).where(eq(businessSubscriptions.isEarlyAdopter, true))) as [{ n: number }];
  const remaining = Math.max(0, early.limit - n);
  return {
    plans,
    early: { limit: early.limit, months: early.trialMonths, remaining },
    defaultTrialMonths: defaultTrial,
    currentFreeMonths: remaining > 0 ? early.trialMonths : defaultTrial,
  };
}

export async function submitApplication(db: DB, input: ApplicationInput, meta: { ip: string }) {
  // Kötüye kullanım: IP başına saatte 3 başvuru
  const rl = await hit(db, `application:${meta.ip}`, { limit: 3, windowSec: 3600 });
  if (!rl.allowed) throw new AppError("RATE_LIMITED", "Çok fazla başvuru denemesi. Lütfen daha sonra tekrar deneyin.");
  const [d] = await db.select({ id: districts.id }).from(districts).where(and(eq(districts.id, input.districtId), eq(districts.provinceId, input.provinceId)));
  if (!d) throw new AppError("VALIDATION", "İlçe seçilen ile ait değil.", { districtId: "İlçeyi yeniden seçin." });
  const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, input.planId), eq(subscriptionPlans.isActive, true)));
  if (!plan) throw new AppError("VALIDATION", "Seçilen paket bulunamadı.", { planId: "Paket seçin." });
  if (input.billingCycle === "YEARLY" && plan.yearlyPriceKurus == null) throw new AppError("VALIDATION", "Bu pakette yıllık ödeme yok.", { billingCycle: "Aylık seçin." });
  const [dup] = await db
    .select({ id: businessApplications.id })
    .from(businessApplications)
    .where(and(eq(businessApplications.status, "NEW"), or(eq(businessApplications.phone, input.phone), eq(businessApplications.email, input.email))));
  if (dup) throw new AppError("CONFLICT", "Bu telefon veya e-postayla incelenmeyi bekleyen bir başvurunuz zaten var. En kısa sürede size dönüş yapacağız.");

  const [app] = await db
    .insert(businessApplications)
    .values({
      businessName: input.businessName,
      ownerName: input.ownerName,
      phone: input.phone,
      email: input.email,
      provinceId: input.provinceId,
      districtId: input.districtId,
      addressLine: input.addressLine,
      staffCount: input.staffCount,
      planId: plan.id,
      billingCycle: input.billingCycle,
      note: input.note ?? null,
      kvkkConsentAt: new Date(),
      ip: meta.ip,
    })
    .returning();

  const [loc] = await db
    .select({ p: provinces.name, d: districts.name })
    .from(districts)
    .innerJoin(provinces, eq(provinces.id, districts.provinceId))
    .where(eq(districts.id, input.districtId));
  const cycle = input.billingCycle === "YEARLY" ? "Yıllık" : "Aylık";
  for (const to of await adminAlertRecipients(db)) {
    await sendEmail(db, {
      to,
      template: "application.new.admin",
      subject: `Yeni işletme başvurusu: ${input.businessName} (${loc?.d}, ${loc?.p})`,
      text: [
        `${input.businessName} başvurdu.`,
        `Yetkili: ${input.ownerName} · ${formatTrPhone(input.phone)} · ${input.email}`,
        `Konum: ${input.addressLine}, ${loc?.d}/${loc?.p} · Çalışan: ${input.staffCount}`,
        `Paket: ${plan.name} (${cycle})`,
        input.note ? `Not: ${input.note}` : "",
        `İncelemek için: ${siteUrl()}/admin/basvurular`,
      ]
        .filter(Boolean)
        .join("\n"),
      html: layout("Yeni işletme başvurusu", [
        `${input.businessName} başvurdu.`,
        `Yetkili: ${input.ownerName} · ${formatTrPhone(input.phone)} · ${input.email}`,
        `Konum: ${input.addressLine}, ${loc?.d}/${loc?.p} · Çalışan sayısı: ${input.staffCount}`,
        `Seçilen paket: ${plan.name} (${cycle})`,
        ...(input.note ? [`Not: ${input.note}`] : []),
        `İncelemek için yönetim panelinde Başvurular sayfasını açın.`,
      ]),
      dedupeKey: `application.new:${app!.id}:${to}`,
    });
  }
  await sendEmail(db, {
    to: input.email,
    template: "application.received",
    subject: "Başvurunuz alındı · Dijital Berber",
    text: `Merhaba ${input.ownerName}, ${input.businessName} için başvurunuzu aldık. En kısa sürede sizi arayacağız.`,
    html: layout("Başvurunuz alındı", [
      `Merhaba ${input.ownerName},`,
      `${input.businessName} için Dijital Berber başvurunuzu aldık. Ekibimiz en kısa sürede ${formatTrPhone(input.phone)} numarasından size ulaşacak.`,
      `Onaylandığında giriş bilgileriniz bu adrese gönderilecek.`,
    ]),
    dedupeKey: `application.received:${app!.id}`,
  });
  return app!;
}

export function listApplications(db: Executor, status: "NEW" | "APPROVED" | "REJECTED" | "ALL" = "NEW") {
  const q = db
    .select({ a: businessApplications, province: provinces.name, district: districts.name, planName: subscriptionPlans.name })
    .from(businessApplications)
    .innerJoin(provinces, eq(provinces.id, businessApplications.provinceId))
    .innerJoin(districts, eq(districts.id, businessApplications.districtId))
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, businessApplications.planId));
  return (status === "ALL" ? q : q.where(eq(businessApplications.status, status))).orderBy(desc(businessApplications.createdAt)).limit(200);
}

export async function countNewApplications(db: Executor) {
  const [{ n }] = (await db.select({ n: count() }).from(businessApplications).where(eq(businessApplications.status, "NEW"))) as [{ n: number }];
  return n;
}

async function newApplication(db: Executor, id: string) {
  const [a] = await db.select().from(businessApplications).where(eq(businessApplications.id, id));
  if (!a) throw notFound("Başvuru");
  if (a.status !== "NEW") throw new AppError("CONFLICT", "Bu başvuru zaten sonuçlandırılmış.");
  return a;
}

/**
 * Onay: işletme + hesap oluşturulur (ücretsiz süre bu andaki sıraya göre: ilk N işletmeye kampanya, sonrakilere
 * standart), seçilen paket ve ödeme dönemi aboneliğe işlenir, başvurana giriş bilgileri e-postayla gönderilir.
 */
export async function approveApplication(db: DB, actor: AdminActor, id: string) {
  const a = await newApplication(db, id);
  const base = slugify(a.businessName).slice(0, 40) || "isletme";
  let created: Awaited<ReturnType<typeof createBusiness>> | undefined;
  for (let i = 0; i < 4 && !created; i++) {
    const login = `${base}-${randomInt(100, 1000)}`;
    try {
      created = await createBusiness(db, actor, {
        name: a.businessName,
        phone: a.phone,
        email: a.email,
        addressLine: a.addressLine,
        provinceId: a.provinceId,
        districtId: a.districtId,
        ownerName: a.ownerName,
        login,
      });
    } catch (e) {
      // Kullanıcı adı çakışırsa başka sayıyla tekrar dene; diğer hatalar olduğu gibi
      if (!(e instanceof AppError && e.code === "CONFLICT" && /kullanıcı adı/i.test(e.message))) throw e;
    }
  }
  if (!created) throw new AppError("CONFLICT", "Kullanıcı adı oluşturulamadı, tekrar deneyin.");

  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, a.planId));
  const cycle = a.billingCycle === "YEARLY" && plan?.yearlyPriceKurus != null ? "YEARLY" : "MONTHLY";
  const [sub] = await db
    .update(businessSubscriptions)
    .set({ planId: a.planId, monthlyFeeKurus: plan!.monthlyPriceKurus, yearlyFeeKurus: plan!.yearlyPriceKurus, billingCycle: cycle, updatedAt: new Date() })
    .where(eq(businessSubscriptions.businessId, created.businessId))
    .returning();
  await db
    .update(businessApplications)
    .set({ status: "APPROVED", businessId: created.businessId, reviewedByAdminId: actor.adminId, reviewedAt: new Date() })
    .where(eq(businessApplications.id, id));
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, businessId: created.businessId, action: "application.approve", entity: "application", entityId: id, ip: actor.ip });

  const loginUrl = `${siteUrl()}/isletme/${created.slug}`;
  await sendEmail(db, {
    to: a.email,
    template: "application.approved",
    businessId: created.businessId,
    subject: "Başvurunuz onaylandı · Dijital Berber giriş bilgileriniz",
    text: `Merhaba ${a.ownerName}, başvurunuz onaylandı. Giriş: ${loginUrl} · Kullanıcı adı: ${created.login} · Geçici şifre: ${created.tempPassword} (ilk girişte değiştirmeniz istenecek).`,
    html: layout("Başvurunuz onaylandı", [
      `Merhaba ${a.ownerName},`,
      `${a.businessName} artık Dijital Berber'de. ${sub!.trialMonths} ay ücretsiz kullanım hakkınız tanımlandı.`,
      `Giriş adresi: ${loginUrl}`,
      `Giriş için e-posta adresiniz (${a.email}) ya da kullanıcı adınız (${created.login}) ile geçici şifrenizi kullanın.`,
      `Geçici şifre: ${created.tempPassword}`,
      `İlk girişte şifrenizi değiştirmeniz istenecek. Ardından çalışma saatlerinizi, çalışanlarınızı ve hizmetlerinizi ekleyin; profiliniz yayına hazır olsun.`,
    ]),
    dedupeKey: `application.approved:${id}`,
  });
  return { ...created, trialMonths: sub!.trialMonths, isEarlyAdopter: sub!.isEarlyAdopter };
}

export async function rejectApplication(db: DB, actor: AdminActor, id: string, reason?: string) {
  const a = await newApplication(db, id);
  await db
    .update(businessApplications)
    .set({ status: "REJECTED", rejectReason: reason ?? null, reviewedByAdminId: actor.adminId, reviewedAt: new Date() })
    .where(eq(businessApplications.id, id));
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "application.reject", entity: "application", entityId: id, meta: { reason }, ip: actor.ip });
  await sendEmail(db, {
    to: a.email,
    template: "application.rejected",
    subject: "Başvurunuz hakkında · Dijital Berber",
    text: `Merhaba ${a.ownerName}, ${a.businessName} başvurunuzu şu an kabul edemiyoruz.${reason ? ` Açıklama: ${reason}` : ""}`,
    html: layout("Başvurunuz hakkında", [
      `Merhaba ${a.ownerName},`,
      `${a.businessName} için yaptığınız başvuruyu şu an kabul edemiyoruz.`,
      ...(reason ? [`Açıklama: ${reason}`] : []),
      `Sorularınız için bu e-postayı yanıtlayabilirsiniz.`,
    ]),
    dedupeKey: `application.rejected:${id}`,
  });
}
