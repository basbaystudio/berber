"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/guards";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { runBillingEnforcement } from "@/server/modules/billing/enforcement";
import { readInvoiceUpload, uploadInvoice } from "@/server/modules/billing/invoices";
import {
  campaignSchema,
  changePlanSchema,
  createPlan,
  disableBilling,
  enableBilling,
  paymentSchema,
  planSchema,
  recordPayment,
  setDefaultPlan,
  updateBusinessSubscription,
  updateCampaign,
  updatePlan,
} from "@/server/modules/billing/subscriptions";

async function actor() {
  const ctx = await requireAdmin();
  return { adminId: ctx.admin.id, ip: (await getRequestMeta()).ip };
}
const id = z.string().uuid();
const done = (message: string): ActionState => {
  revalidatePath("/admin", "layout");
  return { status: "success", message };
};

export async function createPlanAction(_p: ActionState, fd: FormData) {
  return runAction(async () => {
    const a = await actor();
    await createPlan(db, a, parseInput(planSchema, formToObject(fd)));
    return done("Paket eklendi.");
  });
}

export async function updatePlanAction(planId: string, _p: ActionState, fd: FormData) {
  return runAction(async () => {
    const a = await actor();
    await updatePlan(db, a, id.parse(planId), parseInput(planSchema, formToObject(fd)));
    return done("Paket kaydedildi.");
  });
}

export async function setDefaultPlanAction(planId: string) {
  return runAction(async () => {
    const a = await actor();
    await setDefaultPlan(db, a, id.parse(planId));
    return done("Varsayılan paket değiştirildi. Yeni işletmeler bu paketle başlar.");
  });
}

export async function updateCampaignAction(_p: ActionState, fd: FormData) {
  return runAction(async () => {
    const a = await actor();
    await updateCampaign(db, a, parseInput(campaignSchema, formToObject(fd)));
    return done("Kampanya ayarları kaydedildi.");
  });
}

export async function enableBillingAction() {
  return runAction(async () => {
    await enableBilling(db, await actor());
    return done("Ücretlendirme başladı. İşletmelerin ücretsiz deneme süreleri bugünden itibaren işliyor.");
  });
}

export async function disableBillingAction() {
  return runAction(async () => {
    await disableBilling(db, await actor());
    return done("Ücretlendirme durduruldu. Tüm işletmeler ücretsiz dönemde.");
  });
}

export async function updateSubscriptionAction(businessId: string, _p: ActionState, fd: FormData) {
  return runAction(async () => {
    const a = await actor();
    await updateBusinessSubscription(db, a, id.parse(businessId), parseInput(changePlanSchema, formToObject(fd)));
    return done("Abonelik güncellendi.");
  });
}

export async function recordPaymentAction(businessId: string, _p: ActionState, fd: FormData) {
  return runAction(async () => {
    const a = await actor();
    const p = await recordPayment(db, a, id.parse(businessId), parseInput(paymentSchema, formToObject(fd)));
    return done(`Ödeme kaydedildi. Kapsanan dönem: ${p.coversFrom} – ${p.coversTo}.`);
  });
}

/** Günlük abonelik kontrolünü elle çalıştırır (normalde her gün 09:00'da otomatik çalışır). */
export async function runEnforcementAction(): Promise<ActionState> {
  return runAction(async () => {
    await actor();
    const r = await runBillingEnforcement(db);
    revalidatePath("/admin", "layout");
    if (r.skipped) return { status: "success", message: "Ücretlendirme kapalı; yapılacak işlem yok." };
    return {
      status: "success",
      message: `Kontrol tamamlandı: ${r.pastDueNotified} işletmeye gecikme bildirimi gönderildi, ${r.suspended} işletme askıya alındı${r.emailsFailed ? `, ${r.emailsFailed} e-posta gönderilemedi` : ""}.`,
    };
  });
}

export async function uploadInvoiceAction(paymentId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const a = await actor();
    await uploadInvoice(db, a, id.parse(paymentId), await readInvoiceUpload(fd.get("file")));
    revalidatePath("/admin", "layout");
    return { status: "success", message: "Fatura yüklendi; işletme panelinde görünür." };
  });
}
