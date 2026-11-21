"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { enforce, RATE_LIMITS } from "@/server/auth/rate-limit";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import {
  createBusiness,
  resetOwnerPassword,
  setBusinessStatus,
  setFeatured,
  setPublished,
  updateBusinessProfile,
  updateOwnerAccount,
  type AdminActor,
} from "@/server/modules/admin/businesses";
import { businessProfileSchema, createBusinessSchema, ownerAccountSchema } from "@/lib/validation/business";

const id = z.string().uuid();

async function actor(): Promise<AdminActor> {
  const ctx = await requireAdmin();
  const { ip } = await getRequestMeta();
  await enforce(db, `admin:write:${ctx.admin.id}`, RATE_LIMITS.adminWrite);
  return { adminId: ctx.admin.id, ip };
}

export type CreatedBusiness = { businessId: string; slug: string; login: string; tempPassword: string };

export async function createBusinessAction(_p: ActionState<CreatedBusiness>, fd: FormData): Promise<ActionState<CreatedBusiness>> {
  return runAction(async () => {
    const a = await actor();
    const input = parseInput(createBusinessSchema, formToObject(fd));
    const r = await createBusiness(db, a, input);
    revalidatePath("/admin", "layout");
    return { status: "success", message: "İşletme oluşturuldu.", data: { businessId: r.businessId, slug: r.slug, login: r.login, tempPassword: r.tempPassword } };
  });
}

export async function updateBusinessAction(businessId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    const input = parseInput(businessProfileSchema, formToObject(fd));
    await updateBusinessProfile(db, a, id.parse(businessId), input);
    revalidatePath("/admin", "layout");
    return { status: "success", message: "İşletme bilgileri kaydedildi." };
  });
}

export async function setStatusAction(businessId: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    await setBusinessStatus(db, a, id.parse(businessId), z.enum(["ACTIVE", "SUSPENDED"]).parse(status));
    revalidatePath("/admin", "layout");
    return { status: "success", message: status === "ACTIVE" ? "İşletme aktifleştirildi." : "İşletme askıya alındı ve yayından kaldırıldı." };
  });
}

export async function setPublishedAction(businessId: string, publish: boolean): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    await setPublished(db, a, id.parse(businessId), z.boolean().parse(publish));
    revalidatePath("/admin", "layout");
    return { status: "success", message: publish ? "İşletme yayına alındı." : "İşletme yayından kaldırıldı." };
  });
}

export async function setFeaturedAction(businessId: string, featured: boolean): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    await setFeatured(db, a, id.parse(businessId), z.boolean().parse(featured));
    revalidatePath("/admin", "layout");
    return { status: "success", message: featured ? "Öne çıkanlara eklendi." : "Öne çıkanlardan çıkarıldı." };
  });
}

export async function resetPasswordAction(businessId: string): Promise<ActionState<{ login: string; tempPassword: string }>> {
  return runAction(async () => {
    const a = await actor();
    const r = await resetOwnerPassword(db, a, id.parse(businessId));
    revalidatePath(`/admin/isletmeler/${businessId}`);
    return { status: "success", message: "Yeni geçici şifre oluşturuldu.", data: r };
  });
}

export async function updateOwnerAction(businessId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    const input = parseInput(ownerAccountSchema, formToObject(fd));
    await updateOwnerAccount(db, a, id.parse(businessId), input);
    revalidatePath(`/admin/isletmeler/${businessId}`);
    return { status: "success", message: "Hesap bilgileri kaydedildi." };
  });
}
