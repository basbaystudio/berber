"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { login } from "@/server/auth/login";
import { clearSessionCookie, getAdmin, readSessionToken, writeSessionCookie } from "@/server/auth/guards";
import { invalidateSession } from "@/server/auth/session";
import { audit } from "@/server/lib/audit";
import { parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";

const schema = z.object({
  identifier: z.string().trim().min(1, "E-posta gerekli.").max(254),
  password: z.string().min(1, "Şifre gerekli.").max(256),
});

export async function adminLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseInput(schema, Object.fromEntries(formData));
    const meta = await getRequestMeta();
    const { token } = await login(db, "ADMIN", input.identifier, input.password, meta);
    await writeSessionCookie("ADMIN", token);
    redirect("/admin");
  });
}

export async function adminLogoutAction() {
  const ctx = await getAdmin();
  const token = await readSessionToken("ADMIN");
  if (token) await invalidateSession(db, token);
  if (ctx) await audit(db, { actorRealm: "ADMIN", actorId: ctx.admin.id, action: "auth.logout", ip: (await getRequestMeta()).ip });
  await clearSessionCookie("ADMIN");
  redirect("/admin");
}
