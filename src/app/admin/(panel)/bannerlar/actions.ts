"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { enforce, RATE_LIMITS } from "@/server/auth/rate-limit";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { assertImageProvided, bannerSchema, createBanner, deleteBanner, updateBanner } from "@/server/modules/admin/banners";
import { readUpload } from "@/server/storage/images";

async function actor() {
  const ctx = await requireAdmin();
  await enforce(db, `upload:admin:${ctx.admin.id}`, RATE_LIMITS.upload);
  return { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip };
}

function revalidate() {
  revalidatePath("/admin/bannerlar");
  revalidatePath("/");
}

export async function createBannerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    const input = parseInput(bannerSchema, formToObject(fd));
    assertImageProvided(fd.get("file"));
    await createBanner(db, a, input, await readUpload(fd.get("file"), "Banner görseli"));
    revalidate();
    return { status: "success", message: "Banner eklendi." };
  });
}

export async function updateBannerAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    const input = parseInput(bannerSchema, formToObject(fd));
    const file = fd.get("file");
    const image = file && typeof file !== "string" && file.size > 0 ? await readUpload(file) : null;
    await updateBanner(db, a, z.string().uuid().parse(id), input, image);
    revalidate();
    return { status: "success", message: "Banner kaydedildi." };
  });
}

export async function deleteBannerAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    await deleteBanner(db, a, z.string().uuid().parse(id));
    revalidate();
    return { status: "success", message: "Banner silindi." };
  });
}
