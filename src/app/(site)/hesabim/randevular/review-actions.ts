"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireCustomer } from "@/server/auth/guards";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { createReview, reviewSchema } from "@/server/modules/reviews/reviews";

export async function createReviewAction(appointmentId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireCustomer();
    await createReview(db, ctx.customer.id, z.string().uuid().parse(appointmentId), parseInput(reviewSchema, formToObject(fd)));
    revalidatePath("/hesabim/randevular");
    return { status: "success", message: "Yorumunuz için teşekkürler!" };
  });
}
