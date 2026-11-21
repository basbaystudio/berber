"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { enforce, hit, RATE_LIMITS } from "@/server/auth/rate-limit";
import { deleteShopPhoto, moveShopPhoto, setShopPhotoKind, shopPhotoKind, uploadShopPhoto } from "@/server/modules/shop-photos";
import { geocodeAddress, geocodeSchema, type GeocodeResult } from "@/server/modules/geo/geocode";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import {
  createBusiness,
  removeBusinessImage,
  resetOwnerPassword,
  setBusinessImage,
  setBusinessStatus,
  setFeatured,
  setPublished,
  updateBusinessProfile,
  updateOwnerAccount,
  type AdminActor,
} from "@/server/modules/admin/businesses";
import { businessProfileSchema, createBusinessSchema, ownerAccountSchema } from "@/lib/validation/business";
import { readUpload } from "@/server/storage/images";

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

const imageKind = z.enum(["logo", "cover"]);

export async function uploadBusinessImageAction(businessId: string, kind: "logo" | "cover", _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    await enforce(db, `upload:admin:${a.adminId}`, RATE_LIMITS.upload);
    await setBusinessImage(db, a, id.parse(businessId), imageKind.parse(kind), await readUpload(fd.get("file")));
    revalidatePath(`/admin/isletmeler/${businessId}`);
    return { status: "success", message: kind === "logo" ? "Logo güncellendi." : "Kapak görseli güncellendi." };
  });
}

export async function removeBusinessImageAction(businessId: string, kind: "logo" | "cover"): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    await removeBusinessImage(db, a, id.parse(businessId), imageKind.parse(kind));
    revalidatePath(`/admin/isletmeler/${businessId}`);
    return { status: "success", message: "Kaldırıldı." };
  });
}

/** Adresten harita konumu (yönetici formunda adres girilince otomatik çağrılır). */
export async function geocodeAction(input: { address: string; district?: string; province?: string }): Promise<GeocodeResult> {
  const ctx = await requireAdmin();
  const parsed = geocodeSchema.safeParse(input);
  if (!parsed.success) return null;
  // Harita servisinin kullanım kuralı gereği seyrek: yönetici başına dakikada 20 istek
  const rl = await hit(db, `geocode:${ctx.admin.id}`, { limit: 20, windowSec: 60 });
  if (!rl.allowed) return null;
  return geocodeAddress(parsed.data);
}

// ---- Dükkan fotoğrafları (yönetici) ----
async function shopActor() {
  const ctx = await requireAdmin();
  await enforce(db, `upload:admin:${ctx.admin.id}`, RATE_LIMITS.upload);
  return { realm: "ADMIN" as const, adminId: ctx.admin.id, ip: (await getRequestMeta()).ip };
}
const shopRefresh = (businessId: string) => revalidatePath(`/admin/isletmeler/${businessId}`);

export async function adminUploadShopPhotoAction(businessId: string, fd: FormData): Promise<ActionState<{ used: number }>> {
  return runAction(async () => {
    const a = await shopActor();
    const bid = id.parse(businessId);
    const r = await uploadShopPhoto(db, a, bid, shopPhotoKind.parse(fd.get("kind")), await readUpload(fd.get("file"), "Fotoğraf"));
    shopRefresh(bid);
    return { status: "success", data: { used: r.used } };
  });
}

export async function adminDeleteShopPhotoAction(businessId: string, photoId: string): Promise<ActionState> {
  return runAction(async () => {
    const a = await shopActor();
    const bid = id.parse(businessId);
    await deleteShopPhoto(db, a, bid, id.parse(photoId));
    shopRefresh(bid);
    return { status: "success" };
  });
}

export async function adminSetShopPhotoKindAction(businessId: string, photoId: string, kind: "INTERIOR" | "EXTERIOR"): Promise<ActionState> {
  return runAction(async () => {
    const a = await shopActor();
    const bid = id.parse(businessId);
    await setShopPhotoKind(db, a, bid, id.parse(photoId), shopPhotoKind.parse(kind));
    shopRefresh(bid);
    return { status: "success" };
  });
}

export async function adminMoveShopPhotoAction(businessId: string, photoId: string, dir: "up" | "down"): Promise<ActionState> {
  return runAction(async () => {
    await shopActor();
    const bid = id.parse(businessId);
    await moveShopPhoto(db, bid, id.parse(photoId), z.enum(["up", "down"]).parse(dir));
    shopRefresh(bid);
    return { status: "success" };
  });
}
