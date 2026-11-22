import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { businessUsers, businesses, customers, platformAdmins } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { burnPasswordCheck, verifyPassword } from "./password";
import { createSession } from "./session";
import { enforce, RATE_LIMITS, resetLimit } from "./rate-limit";
import type { Realm } from "./realms";

const INVALID = "Giriş bilgileri hatalı.";

type Principal = { id: string; passwordHash: string; active: boolean; disabledMessage?: string; businessId?: string };

async function findPrincipal(db: Executor, realm: Realm, identifier: string): Promise<Principal | null> {
  const ident = identifier.trim().toLowerCase();
  if (realm === "ADMIN") {
    const [a] = await db.select().from(platformAdmins).where(eq(sql`lower(${platformAdmins.email})`, ident)).limit(1);
    return a ? { id: a.id, passwordHash: a.passwordHash, active: a.isActive } : null;
  }
  if (realm === "BUSINESS") {
    const [row] = await db
      .select({ u: businessUsers, status: businesses.status, reason: businesses.suspendedReason })
      .from(businessUsers)
      .innerJoin(businesses, eq(businesses.id, businessUsers.businessId))
      .where(eq(sql`lower(${businessUsers.login})`, ident))
      .limit(1);
    let found = row;
    // Kullanıcı adı yoksa işletmenin e-postasıyla da giriş yapılabilir (tek işletmeye ait e-postaysa)
    if (!found && ident.includes("@")) {
      const byEmail = await db
        .select({ u: businessUsers, status: businesses.status, reason: businesses.suspendedReason })
        .from(businessUsers)
        .innerJoin(businesses, eq(businesses.id, businessUsers.businessId))
        .where(eq(sql`lower(${businesses.email})`, ident))
        .orderBy(businessUsers.createdAt)
        .limit(20);
      const businessIds = new Set(byEmail.map((r) => r.u.businessId));
      if (businessIds.size === 1) found = byEmail[0];
    }
    if (!found) return null;
    const row2 = found;
    if (row2.status === "SUSPENDED")
      return {
        id: row2.u.id,
        passwordHash: row2.u.passwordHash,
        active: false,
        businessId: row2.u.businessId,
        disabledMessage:
          row2.reason === "BILLING"
            ? "İşletme hesabınız abonelik ödemesi gecikmesi nedeniyle askıya alınmış. Ödeme alındığında hesabınız otomatik olarak açılır; lütfen platform yönetimiyle iletişime geçin."
            : "İşletme hesabınız askıya alınmış. Lütfen platform yönetimiyle iletişime geçin.",
      };
    return { id: row2.u.id, passwordHash: row2.u.passwordHash, active: row2.u.isActive, businessId: row2.u.businessId };
  }
  const [c] = await db.select().from(customers).where(eq(sql`lower(${customers.email})`, ident)).limit(1);
  return c ? { id: c.id, passwordHash: c.passwordHash, active: c.deletedAt === null } : null;
}

/**
 * Ortak giriş akışı. IP ve hesap bazında rate limit, sabit süreli hata yanıtı, denetim kaydı.
 * Başarılıysa yeni oturum token'ı döner (çerezi çağıran taraf yazar).
 */
export async function login(
  db: Executor,
  realm: Realm,
  identifier: string,
  password: string,
  meta: { ip: string; userAgent: string | null },
): Promise<{ token: string; principalId: string; expiresAt: Date }> {
  const ident = identifier.trim().toLowerCase();
  await enforce(db, `login:ip:${realm}:${meta.ip}`, RATE_LIMITS.loginIp);
  const accountKey = `login:acct:${realm}:${ident}`;
  await enforce(db, accountKey, RATE_LIMITS.loginAccount);

  const p = await findPrincipal(db, realm, ident);
  if (!p) {
    await burnPasswordCheck(password);
    await audit(db, { actorRealm: realm, action: "auth.login_failed", meta: { reason: "unknown_account" }, ip: meta.ip });
    throw new AppError("INVALID_CREDENTIALS", INVALID);
  }
  const ok = await verifyPassword(p.passwordHash, password);
  if (!ok) {
    await audit(db, { actorRealm: realm, actorId: p.id, businessId: p.businessId, action: "auth.login_failed", meta: { reason: "bad_password" }, ip: meta.ip });
    throw new AppError("INVALID_CREDENTIALS", INVALID);
  }
  // Pasif hesap bilgisini yalnızca şifre doğruysa söyle (hesap varlığını sızdırmamak için)
  if (!p.active) {
    throw new AppError("ACCOUNT_DISABLED", p.disabledMessage ?? "Hesabınız devre dışı bırakılmış.");
  }

  await resetLimit(db, accountKey);
  const { token, session } = await createSession(db, realm, p.id, meta);
  const now = new Date();
  if (realm === "ADMIN") await db.update(platformAdmins).set({ lastLoginAt: now }).where(eq(platformAdmins.id, p.id));
  if (realm === "BUSINESS") {
    await db.update(businessUsers).set({ lastLoginAt: now }).where(eq(businessUsers.id, p.id));
    await db.update(businesses).set({ lastPanelActivityAt: now }).where(eq(businesses.id, p.businessId!));
  }
  if (realm === "CUSTOMER") await db.update(customers).set({ lastLoginAt: now }).where(eq(customers.id, p.id));
  await audit(db, { actorRealm: realm, actorId: p.id, businessId: p.businessId, action: "auth.login", ip: meta.ip });
  return { token, principalId: p.id, expiresAt: session.expiresAt };
}
