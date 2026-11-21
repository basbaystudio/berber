"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import {
  categorySchema,
  createCategory,
  deleteCategory,
  deletePhoto,
  movePhoto,
  photoMetaSchema,
  replacePhoto,
  updatePhotoMeta,
  uploadPhoto,
} from "@/server/modules/business/portfolio";
import { readUpload } from "@/server/storage/images";
import { bizActor } from "../_actor";

const id = z.string().uuid();
const refresh = () => revalidatePath("/isletme/panel", "layout");

export async function uploadPhotoAction(fd: FormData): Promise<ActionState<{ used: number }>> {
  return runAction(async () => {
    const biz = await bizActor({ upload: true });
    const meta = parseInput(photoMetaSchema, formToObject(fd));
    const r = await uploadPhoto(db, biz, await readUpload(fd.get("file"), "Fotoğraf"), meta);
    refresh();
    return { status: "success", data: { used: r.used } };
  });
}

export async function updatePhotoMetaAction(photoId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await updatePhotoMeta(db, biz, id.parse(photoId), parseInput(photoMetaSchema, formToObject(fd)));
    refresh();
    return { status: "success", message: "Kaydedildi." };
  });
}

export async function replacePhotoAction(photoId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor({ upload: true });
    await replacePhoto(db, biz, id.parse(photoId), await readUpload(fd.get("file"), "Fotoğraf"));
    refresh();
    return { status: "success", message: "Fotoğraf değiştirildi." };
  });
}

export async function deletePhotoAction(photoId: string): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await deletePhoto(db, biz, id.parse(photoId));
    refresh();
    return { status: "success", message: "Fotoğraf silindi." };
  });
}

export async function movePhotoAction(photoId: string, dir: "up" | "down"): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await movePhoto(db, biz, id.parse(photoId), z.enum(["up", "down"]).parse(dir));
    refresh();
    return { status: "success" };
  });
}

export async function createCategoryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await createCategory(db, biz, parseInput(categorySchema, formToObject(fd)).name);
    refresh();
    return { status: "success", message: "Kategori eklendi." };
  });
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await deleteCategory(db, biz, id.parse(categoryId));
    refresh();
    return { status: "success", message: "Kategori silindi." };
  });
}
