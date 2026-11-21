import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { businessUsers, businesses, customers, platformAdmins } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { validateSession, type Session } from "./session";
import { cookieName, REALMS, type Realm } from "./realms";

export type AdminContext = { realm: "ADMIN"; session: Session; admin: { id: string; email: string; name: string } };
export type BusinessContext = {
  realm: "BUSINESS";
  session: Session;
  user: { id: string; name: string; login: string; mustChangePassword: boolean };
  /** Bütün işletme sorguları bu değerle sınırlandırılır. Asla istekten alınmaz. */
  businessId: string;
  business: { id: string; name: string; slug: string; status: "DRAFT" | "ACTIVE" | "SUSPENDED"; isPublished: boolean };
};
export type CustomerContext = { realm: "CUSTOMER"; session: Session; customer: { id: string; name: string; email: string; emailVerified: boolean } };

export async function readSessionToken(realm: Realm) {
  return (await cookies()).get(cookieName(realm))?.value;
}

export async function writeSessionCookie(realm: Realm, token: string) {
  const store = await cookies();
  store.set(cookieName(realm), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(REALMS[realm].ttlMs / 1000),
  });
}

export async function clearSessionCookie(realm: Realm) {
  (await cookies()).delete(cookieName(realm));
}

/** İstek başına bir kez doğrulanır (React cache). */
export const getAdmin = cache(async (): Promise<AdminContext | null> => {
  const session = await validateSession(db, "ADMIN", await readSessionToken("ADMIN"));
  if (!session) return null;
  const [a] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, session.principalId)).limit(1);
  if (!a || !a.isActive) return null;
  return { realm: "ADMIN", session, admin: { id: a.id, email: a.email, name: a.name } };
});

export const getBusiness = cache(async (): Promise<BusinessContext | null> => {
  const session = await validateSession(db, "BUSINESS", await readSessionToken("BUSINESS"));
  if (!session) return null;
  const [row] = await db
    .select({ u: businessUsers, b: businesses })
    .from(businessUsers)
    .innerJoin(businesses, eq(businesses.id, businessUsers.businessId))
    .where(eq(businessUsers.id, session.principalId))
    .limit(1);
  if (!row || !row.u.isActive || row.b.status === "SUSPENDED") return null;
  const last = row.b.lastPanelActivityAt?.getTime() ?? 0;
  if (Date.now() - last > 10 * 60_000) {
    await db.update(businesses).set({ lastPanelActivityAt: new Date() }).where(eq(businesses.id, row.b.id));
  }
  return {
    realm: "BUSINESS",
    session,
    user: { id: row.u.id, name: row.u.name, login: row.u.login, mustChangePassword: row.u.mustChangePassword },
    businessId: row.b.id,
    business: { id: row.b.id, name: row.b.name, slug: row.b.slug, status: row.b.status, isPublished: row.b.isPublished },
  };
});

export const getCustomer = cache(async (): Promise<CustomerContext | null> => {
  const session = await validateSession(db, "CUSTOMER", await readSessionToken("CUSTOMER"));
  if (!session) return null;
  const [c] = await db.select().from(customers).where(eq(customers.id, session.principalId)).limit(1);
  if (!c || c.deletedAt) return null;
  return { realm: "CUSTOMER", session, customer: { id: c.id, name: c.name, email: c.email, emailVerified: !!c.emailVerifiedAt } };
});

/** Sayfalar için: oturum yoksa giriş sayfasına yönlendirir. */
export async function requireAdminPage(): Promise<AdminContext> {
  const ctx = await getAdmin();
  if (!ctx) redirect(REALMS.ADMIN.loginPath);
  return ctx;
}

export async function requireBusinessPage(opts: { allowPasswordChange?: boolean } = {}): Promise<BusinessContext> {
  const ctx = await getBusiness();
  if (!ctx) redirect(REALMS.BUSINESS.loginPath);
  if (ctx.user.mustChangePassword && !opts.allowPasswordChange) redirect("/isletme/sifre-degistir");
  return ctx;
}

/** Server action'lar ve API için: oturum yoksa hata fırlatır. */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdmin();
  if (!ctx) throw new AppError("UNAUTHENTICATED", "Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.");
  return ctx;
}

export async function requireBusiness(opts: { allowPasswordChange?: boolean } = {}): Promise<BusinessContext> {
  const ctx = await getBusiness();
  if (!ctx) throw new AppError("UNAUTHENTICATED", "Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.");
  if (ctx.user.mustChangePassword && !opts.allowPasswordChange)
    throw new AppError("FORBIDDEN", "Devam etmeden önce şifrenizi değiştirmeniz gerekiyor.");
  return ctx;
}

/** Sayfalar için: oturum yoksa girişe yönlendirir (dönüş adresiyle). */
export async function requireCustomerPage(next: string): Promise<CustomerContext> {
  const ctx = await getCustomer();
  if (!ctx) redirect(`/giris?next=${encodeURIComponent(next)}`);
  return ctx;
}

export async function requireCustomer(): Promise<CustomerContext> {
  const ctx = await getCustomer();
  if (!ctx) throw new AppError("UNAUTHENTICATED", "Bu işlem için giriş yapmanız gerekiyor.");
  return ctx;
}
