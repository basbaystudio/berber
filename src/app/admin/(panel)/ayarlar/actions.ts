"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { audit } from "@/server/lib/audit";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { setSetting } from "@/server/modules/platform/settings";
import { emptyToUndefined } from "@/lib/validation/common";

const optEmail = z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().email("Geçerli bir e-posta girin.").max(254).optional());
const contactSchema = z.object({
  email: optEmail,
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(30, "En fazla 30 karakter.").optional()),
  alertEmail: optEmail,
});

export async function saveContactAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const input = parseInput(contactSchema, formToObject(fd));
    await setSetting(db, "platform.contact", { email: input.email ?? "", phone: input.phone ?? "", alertEmail: input.alertEmail ?? "" }, ctx.admin.id);
    await audit(db, { actorRealm: "ADMIN", actorId: ctx.admin.id, action: "settings.contact_update", ip: (await getRequestMeta()).ip });
    revalidatePath("/admin/ayarlar");
    return { status: "success", message: "Kaydedildi." };
  });
}

const bankSchema = z.object({
  bankName: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  accountName: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  iban: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() || undefined : v),
    z.string().regex(/^TR\d{24}$/, "Geçerli bir TR IBAN girin (TR + 24 rakam).").optional(),
  ),
});

export async function saveBankAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const input = parseInput(bankSchema, formToObject(fd));
    await setSetting(db, "billing.bankTransfer", { bankName: input.bankName ?? "", accountName: input.accountName ?? "", iban: input.iban ?? "" }, ctx.admin.id);
    await audit(db, { actorRealm: "ADMIN", actorId: ctx.admin.id, action: "settings.bank_update", ip: (await getRequestMeta()).ip });
    revalidatePath("/admin/ayarlar");
    return { status: "success", message: "Banka bilgileri kaydedildi." };
  });
}

const legalSchema = z.object({
  customerPrivacy: z.string().max(100_000).default(""),
  terms: z.string().max(100_000).default(""),
});

export async function saveLegalAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const v = parseInput(legalSchema, formToObject(fd));
    await setSetting(db, "legal.customerPrivacy", v.customerPrivacy.trim(), ctx.admin.id);
    await setSetting(db, "legal.terms", v.terms.trim(), ctx.admin.id);
    await audit(db, { actorRealm: "ADMIN", actorId: ctx.admin.id, action: "settings.legal_update", ip: (await getRequestMeta()).ip });
    revalidatePath("/admin/ayarlar");
    return { status: "success", message: "Yasal metinler kaydedildi." };
  });
}
