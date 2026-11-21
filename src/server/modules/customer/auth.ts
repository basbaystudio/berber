import "server-only";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { appointments, authTokens, businessCustomers, customers, favorites } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { hashPassword, passwordSchema, verifyPassword } from "@/server/auth/password";
import { createSession, invalidateAllSessions } from "@/server/auth/session";
import { enforce, RATE_LIMITS } from "@/server/auth/rate-limit";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { sendEmail } from "@/server/notifications/mailer";
import { email, trimmed, trPhone } from "@/lib/validation/common";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function mail(title: string, lines: string[], link: { url: string; label: string }) {
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#292524"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:28px"><h1 style="font-size:18px;margin:0 0 16px">${esc(title)}</h1>${lines
    .map((l) => `<p style="margin:0 0 12px;line-height:1.6">${esc(l)}</p>`)
    .join("")}<p style="margin:20px 0"><a href="${esc(link.url)}" style="background:#1c1917;color:#fff;text-decoration:none;padding:10px 18px;border-radius:12px;display:inline-block">${esc(link.label)}</a></p><p style="font-size:12px;color:#a8a29e;word-break:break-all">${esc(link.url)}</p></div></div></body></html>`;
  return { subject: title, text: `${lines.join("\n\n")}\n\n${link.label}: ${link.url}`, html };
}

export const registerSchema = z
  .object({
    name: trimmed(2, 80, "Ad soyad"),
    email,
    phone: trPhone,
    password: passwordSchema,
    passwordConfirm: z.string(),
    kvkk: z.literal("on", { error: "Devam etmek için aydınlatma metnini onaylayın." }),
    marketing: z.preprocess((v) => v === "on", z.boolean()),
  })
  .refine((v) => v.password === v.passwordConfirm, { message: "Şifreler eşleşmiyor.", path: ["passwordConfirm"] });

async function issueToken(db: Executor, customerId: string, purpose: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlMs: number) {
  // Aynı amaçlı eski token'lar geçersiz
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.realm, "CUSTOMER"), eq(authTokens.principalId, customerId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
  const token = generateToken();
  await db.insert(authTokens).values({ id: hashToken(token), realm: "CUSTOMER", principalId: customerId, purpose, expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

/** Tek kullanımlık token'ı tüketir; geçersiz/süresi dolmuşsa hata. */
async function consumeToken(db: Executor, token: string, purpose: "EMAIL_VERIFY" | "PASSWORD_RESET") {
  if (!token || token.length > 128) throw new AppError("VALIDATION", "Bağlantı geçersiz.");
  const [t] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.id, hashToken(token)), eq(authTokens.purpose, purpose), eq(authTokens.realm, "CUSTOMER"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .returning();
  if (!t) throw new AppError("VALIDATION", "Bağlantı geçersiz ya da süresi dolmuş. Lütfen yeni bağlantı isteyin.");
  return t.principalId;
}

export async function sendVerificationEmail(db: Executor, customer: { id: string; name: string; email: string }) {
  const token = await issueToken(db, customer.id, "EMAIL_VERIFY", 48 * 3_600_000);
  const t = mail("E-posta adresinizi doğrulayın", [`Merhaba ${customer.name}, Berber Randevu hesabınızı oluşturdunuz.`, "Randevu alabilmek için e-posta adresinizi doğrulayın. Bağlantı 48 saat geçerlidir."], {
    url: `${appUrl()}/dogrula?token=${token}`,
    label: "E-postamı doğrula",
  });
  await sendEmail(db, { ...t, to: customer.email, template: "customer.verify_email" });
}

/** Kayıt: hesap açılır, doğrulama e-postası gider, oturum başlar. */
export async function registerCustomer(db: DB, input: z.infer<typeof registerSchema>, meta: { ip: string; userAgent: string | null }) {
  await enforce(db, `register:ip:${meta.ip}`, RATE_LIMITS.register);
  const passwordHash = await hashPassword(input.password);
  const [exists] = await db.select({ id: customers.id }).from(customers).where(eq(sql`lower(${customers.email})`, input.email));
  if (exists) throw new AppError("CONFLICT", "Bu e-posta adresiyle kayıtlı bir hesap var. Giriş yapabilir ya da şifrenizi sıfırlayabilirsiniz.", { email: "Bu e-posta kayıtlı." });
  const c = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(customers)
      .values({ name: input.name, email: input.email, phone: input.phone, passwordHash, kvkkConsentAt: new Date(), marketingConsent: input.marketing })
      .returning();
    await audit(tx, { actorRealm: "CUSTOMER", actorId: c!.id, action: "customer.register", ip: meta.ip });
    return c!;
  });
  await sendVerificationEmail(db, c);
  const { token } = await createSession(db, "CUSTOMER", c.id, meta);
  return { customer: c, token };
}

export async function verifyEmail(db: DB, token: string) {
  const customerId = await consumeToken(db, token, "EMAIL_VERIFY");
  await db.update(customers).set({ emailVerifiedAt: new Date() }).where(and(eq(customers.id, customerId), isNull(customers.emailVerifiedAt)));
  return customerId;
}

export async function resendVerification(db: DB, customerId: string, ip: string) {
  await enforce(db, `verify:resend:${customerId}`, { limit: 3, windowSec: 3600 });
  void ip;
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!c || c.emailVerifiedAt) return;
  await sendVerificationEmail(db, c);
}

/** Şifre sıfırlama isteği: hesap olsun olmasın aynı yanıt (hesap varlığı sızdırılmaz). */
export async function requestPasswordReset(db: DB, emailAddr: string, ip: string) {
  await enforce(db, `reset:ip:${ip}`, RATE_LIMITS.passwordReset);
  const e = emailAddr.trim().toLowerCase();
  await enforce(db, `reset:acct:${e}`, { limit: 3, windowSec: 3600 });
  const [c] = await db.select().from(customers).where(and(eq(sql`lower(${customers.email})`, e), isNull(customers.deletedAt)));
  if (!c) return;
  const token = await issueToken(db, c.id, "PASSWORD_RESET", 3_600_000);
  const t = mail("Şifre sıfırlama", [`Merhaba ${c.name}, şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın. Bağlantı 1 saat geçerlidir.`, "Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz."], {
    url: `${appUrl()}/sifre-sifirla?token=${token}`,
    label: "Şifremi sıfırla",
  });
  await sendEmail(db, { ...t, to: c.email, template: "customer.password_reset" });
}

export async function resetPassword(db: DB, token: string, newPassword: string) {
  const customerId = await consumeToken(db, token, "PASSWORD_RESET");
  await db.update(customers).set({ passwordHash: await hashPassword(newPassword), emailVerifiedAt: sql`coalesce(${customers.emailVerifiedAt}, now())` }).where(eq(customers.id, customerId));
  await invalidateAllSessions(db, "CUSTOMER", customerId);
  await audit(db, { actorRealm: "CUSTOMER", actorId: customerId, action: "auth.password_reset" });
}

export async function changeCustomerPassword(db: DB, customerId: string, sessionId: string, current: string, next: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!c || !(await verifyPassword(c.passwordHash, current))) throw new AppError("VALIDATION", "Mevcut şifre hatalı.", { currentPassword: "Mevcut şifre hatalı." });
  await db.update(customers).set({ passwordHash: await hashPassword(next) }).where(eq(customers.id, customerId));
  await invalidateAllSessions(db, "CUSTOMER", customerId, sessionId);
  await audit(db, { actorRealm: "CUSTOMER", actorId: customerId, action: "auth.password_changed" });
}

export const profileSchema = z.object({ name: trimmed(2, 80, "Ad soyad"), phone: trPhone, marketing: z.preprocess((v) => v === "on", z.boolean()) });

export async function updateCustomerProfile(db: DB, customerId: string, input: z.infer<typeof profileSchema>) {
  await db.update(customers).set({ name: input.name, phone: input.phone, marketingConsent: input.marketing }).where(eq(customers.id, customerId));
}

/**
 * Hesap silme (KVKK): yaklaşan aktif randevu varsa önce iptal edilmeli. Kişisel veriler anonimleştirilir,
 * geçmiş randevu kayıtları işletme muhasebesi için anonim olarak kalır.
 */
export async function deleteCustomerAccount(db: DB, customerId: string, password: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!c || !(await verifyPassword(c.passwordHash, password))) throw new AppError("VALIDATION", "Şifre hatalı.", { password: "Şifre hatalı." });
  const [upcoming] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.customerId, customerId), inArray(appointments.status, ["PENDING", "CONFIRMED"]), gt(appointments.startsAt, new Date())))
    .limit(1);
  if (upcoming) throw new AppError("CONFLICT", "Yaklaşan randevularınız var. Hesabınızı silmeden önce lütfen randevularınızı iptal edin.");
  await db.transaction(async (tx) => {
    await tx
      .update(customers)
      .set({ name: "Silinmiş kullanıcı", email: `silinmis-${customerId}@silindi.invalid`, phone: "+900000000000", passwordHash: "!", marketingConsent: false, deletedAt: new Date() })
      .where(eq(customers.id, customerId));
    await tx.delete(favorites).where(eq(favorites.customerId, customerId));
    // İşletme kayıtlarındaki iletişim bilgileri de anonimleştirilir (randevu geçmişi anonim kalır)
    await tx.update(businessCustomers).set({ displayName: "Silinmiş kullanıcı", phone: null, email: null }).where(eq(businessCustomers.customerId, customerId));
    await invalidateAllSessions(tx, "CUSTOMER", customerId);
    await audit(tx, { actorRealm: "CUSTOMER", actorId: customerId, action: "customer.delete" });
  });
}
