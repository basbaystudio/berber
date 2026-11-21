"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { login } from "@/server/auth/login";
import { clearSessionCookie, getBusiness, readSessionToken, requireBusiness, writeSessionCookie } from "@/server/auth/guards";
import { invalidateSession } from "@/server/auth/session";
import { passwordSchema } from "@/server/auth/password";
import { audit } from "@/server/lib/audit";
import { AppError } from "@/server/lib/errors";
import { parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { changeBusinessPassword } from "@/server/modules/business/account";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Kullanıcı adı gerekli.").max(254),
  password: z.string().min(1, "Şifre gerekli.").max(256),
});

export async function businessLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseInput(loginSchema, Object.fromEntries(formData));
    const meta = await getRequestMeta();
    const { token } = await login(db, "BUSINESS", input.identifier, input.password, meta);
    await writeSessionCookie("BUSINESS", token);
    redirect("/isletme/panel");
  });
}

export async function businessLogoutAction() {
  const ctx = await getBusiness();
  const token = await readSessionToken("BUSINESS");
  if (token) await invalidateSession(db, token);
  if (ctx) await audit(db, { actorRealm: "BUSINESS", actorId: ctx.user.id, businessId: ctx.businessId, action: "auth.logout" });
  await clearSessionCookie("BUSINESS");
  redirect("/isletme/giris");
}

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifre gerekli.").max(256),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Şifreler eşleşmiyor.", path: ["confirmPassword"] });

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireBusiness({ allowPasswordChange: true });
    const input = parseInput(changeSchema, Object.fromEntries(formData));
    const { ip } = await getRequestMeta();
    if (!ctx) throw new AppError("UNAUTHENTICATED", "Oturum bulunamadı.");
    await changeBusinessPassword(
      db,
      { userId: ctx.user.id, businessId: ctx.businessId, sessionId: ctx.session.id, ip },
      input.currentPassword,
      input.newPassword,
    );
    redirect("/isletme/panel?sifre=degisti");
  });
}
