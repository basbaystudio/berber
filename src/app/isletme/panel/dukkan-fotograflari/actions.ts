"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { runAction, type ActionState } from "@/server/lib/action";
import { deleteShopPhoto, moveShopPhoto, setShopPhotoKind, shopPhotoKind, uploadShopPhoto } from "@/server/modules/shop-photos";
import { readUpload } from "@/server/storage/images";
import { bizActor } from "../_actor";

const id = z.string().uuid();
const refresh = () => revalidatePath("/isletme/panel/dukkan-fotograflari");

export async function uploadShopPhotoAction(fd: FormData): Promise<ActionState<{ used: number }>> {
  return runAction(async () => {
    const biz = await bizActor({ upload: true });
    const kind = shopPhotoKind.parse(fd.get("kind"));
    const r = await uploadShopPhoto(db, { realm: "BUSINESS", userId: biz.userId }, biz.businessId, kind, await readUpload(fd.get("file"), "Fotoğraf"));
    refresh();
    return { status: "success", data: { used: r.used } };
  });
}

export async function deleteShopPhotoAction(photoId: string): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await deleteShopPhoto(db, { realm: "BUSINESS", userId: biz.userId }, biz.businessId, id.parse(photoId));
    refresh();
    return { status: "success" };
  });
}

export async function setShopPhotoKindAction(photoId: string, kind: "INTERIOR" | "EXTERIOR"): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await setShopPhotoKind(db, { realm: "BUSINESS", userId: biz.userId }, biz.businessId, id.parse(photoId), shopPhotoKind.parse(kind));
    refresh();
    return { status: "success" };
  });
}

export async function moveShopPhotoAction(photoId: string, dir: "up" | "down"): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await moveShopPhoto(db, biz.businessId, id.parse(photoId), z.enum(["up", "down"]).parse(dir));
    refresh();
    return { status: "success" };
  });
}
