"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { methodSchema, setPaymentMethod, startCardSetup } from "@/server/modules/business/billing";
import { bizActor } from "../_actor";

export async function setMethodAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const { method } = parseInput(methodSchema, formToObject(fd));
    await setPaymentMethod(db, biz, method);
    revalidatePath("/isletme/panel/abonelik");
    return { status: "success", message: method === "CARD" ? "Ödeme yöntemi: kartla otomatik ödeme." : "Ödeme yöntemi: havale / EFT." };
  });
}

/** Kart tanımlama/değiştirme: ödeme sağlayıcısının güvenli sayfasına yönlendirir. */
export async function cardSetupAction(): Promise<ActionState> {
  return runAction(async () => {
    const biz = await bizActor();
    const url = await startCardSetup(db, biz, `${process.env.APP_URL ?? ""}/isletme/panel/abonelik`);
    redirect(url);
  });
}
