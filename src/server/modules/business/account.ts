import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "@/server/db/client";
import { businessUsers } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { invalidateAllSessions } from "@/server/auth/session";

/** İşletme hesabının kendi şifresini değiştirmesi. Mevcut oturum hariç tüm oturumlar kapanır. */
export async function changeBusinessPassword(
  db: DB,
  ctx: { userId: string; businessId: string; sessionId: string; ip?: string | null },
  currentPassword: string,
  newPassword: string,
) {
  const [u] = await db.select().from(businessUsers).where(eq(businessUsers.id, ctx.userId)).limit(1);
  if (!u || u.businessId !== ctx.businessId) throw notFound("Hesap");
  if (!(await verifyPassword(u.passwordHash, currentPassword)))
    throw new AppError("VALIDATION", "Mevcut şifre hatalı.", { currentPassword: "Mevcut şifre hatalı." });
  if (currentPassword === newPassword)
    throw new AppError("VALIDATION", "Yeni şifre mevcut şifreden farklı olmalı.", { newPassword: "Yeni şifre mevcut şifreden farklı olmalı." });
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(businessUsers).set({ passwordHash, mustChangePassword: false }).where(eq(businessUsers.id, u.id));
    await invalidateAllSessions(tx, "BUSINESS", u.id, ctx.sessionId);
    await audit(tx, { actorRealm: "BUSINESS", actorId: u.id, businessId: ctx.businessId, action: "auth.password_changed", ip: ctx.ip });
  });
}
