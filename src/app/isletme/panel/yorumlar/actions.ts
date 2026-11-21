"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { replySchema, replyToReview, reportReview, reportSchema } from "@/server/modules/reviews/reviews";
import { bizActor } from "../_actor";

export async function replyAction(reviewId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await replyToReview(db, biz, z.string().uuid().parse(reviewId), parseInput(replySchema, formToObject(fd)).reply);
    revalidatePath("/isletme/panel/yorumlar");
    return { status: "success", message: "Yanıtınız yayınlandı." };
  });
}

export async function reportAction(reviewId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    await reportReview(db, biz, z.string().uuid().parse(reviewId), parseInput(reportSchema, formToObject(fd)));
    revalidatePath("/isletme/panel/yorumlar");
    return { status: "success", message: "Şikâyetiniz platform yönetimine iletildi." };
  });
}
