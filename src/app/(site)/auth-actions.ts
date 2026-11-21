"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { login } from "@/server/auth/login";
import { clearSessionCookie, getCustomer, readSessionToken, requireCustomer, writeSessionCookie } from "@/server/auth/guards";
import { invalidateSession } from "@/server/auth/session";
import { passwordSchema } from "@/server/auth/password";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { registerCustomer, registerSchema, requestPasswordReset, resendVerification, resetPassword } from "@/server/modules/customer/auth";
import { safeNext } from "@/lib/safe-next";

export async function customerLoginAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const v = parseInput(z.object({ identifier: z.string().trim().min(1, "E-posta gerekli.").max(254), password: z.string().min(1, "Şifre gerekli.").max(256) }), Object.fromEntries(fd));
    const { token } = await login(db, "CUSTOMER", v.identifier, v.password, await getRequestMeta());
    await writeSessionCookie("CUSTOMER", token);
    redirect(safeNext(fd.get("next")));
  });
}

export async function registerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseInput(registerSchema, formToObject(fd));
    const { token } = await registerCustomer(db, input, await getRequestMeta());
    await writeSessionCookie("CUSTOMER", token);
    redirect(safeNext(fd.get("next"), "/hesabim?kayit=1"));
  });
}

export async function customerLogoutAction() {
  const token = await readSessionToken("CUSTOMER");
  if (token) await invalidateSession(db, token);
  await clearSessionCookie("CUSTOMER");
  redirect("/");
}

export async function forgotPasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const v = parseInput(z.object({ email: z.string().trim().email("Geçerli bir e-posta girin.").max(254) }), Object.fromEntries(fd));
    await requestPasswordReset(db, v.email, (await getRequestMeta()).ip);
    return { status: "success", message: "Bu e-posta ile kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderdik. Lütfen gelen kutunuzu kontrol edin." };
  });
}

export async function resetPasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const v = parseInput(
      z.object({ token: z.string().min(10).max(128), password: passwordSchema, passwordConfirm: z.string() }).refine((x) => x.password === x.passwordConfirm, { message: "Şifreler eşleşmiyor.", path: ["passwordConfirm"] }),
      Object.fromEntries(fd),
    );
    await resetPassword(db, v.token, v.password);
    redirect("/giris?sifre=yenilendi");
  });
}

export async function resendVerificationAction(): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireCustomer();
    await resendVerification(db, ctx.customer.id, (await getRequestMeta()).ip);
    return { status: "success", message: "Doğrulama e-postası yeniden gönderildi." };
  });
}

export async function getCurrentCustomerName() {
  return (await getCustomer())?.customer.name ?? null;
}
