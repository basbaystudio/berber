"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { clearSessionCookie, requireCustomer } from "@/server/auth/guards";
import { passwordSchema } from "@/server/auth/password";
import { formToObject, parseInput, runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { cancelByCustomer, rescheduleAppointment } from "@/server/modules/booking/service";
import { changeCustomerPassword, deleteCustomerAccount, profileSchema, updateCustomerProfile } from "@/server/modules/customer/auth";
import { appointments } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { minuteToDate } from "@/lib/availability";
import { toMinutes } from "@/lib/schedule";
import { dateSchema } from "@/server/modules/booking/availability";

const id = z.string().uuid();
const actorOf = async (cid: string) => ({ realm: "CUSTOMER" as const, id: cid, ip: (await getRequestMeta()).ip });

async function invalidateAvailability(apptId: string) {
  const [a] = await db.select({ businessId: appointments.businessId }).from(appointments).where(eq(appointments.id, apptId));
  if (a) updateTag(`availability:${a.businessId}`);
}

export async function cancelMyAppointmentAction(apptId: string): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireCustomer();
    await cancelByCustomer(db, ctx.customer.id, id.parse(apptId), await actorOf(ctx.customer.id));
    await invalidateAvailability(apptId);
    revalidatePath("/hesabim/randevular");
    return { status: "success", message: "Randevunuz iptal edildi." };
  });
}

export async function rescheduleMyAppointmentAction(apptId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireCustomer();
    const v = parseInput(z.object({ date: dateSchema, time: z.string().regex(/^\d{2}:\d{2}$/, "Saat seçin.") }), formToObject(fd));
    await rescheduleAppointment(db, { customerId: ctx.customer.id }, id.parse(apptId), { startsAt: minuteToDate(v.date, toMinutes(v.time)) }, await actorOf(ctx.customer.id));
    await invalidateAvailability(apptId);
    revalidatePath("/hesabim/randevular");
    return { status: "success", message: "Değişiklik talebiniz işletmeye iletildi; onaylandığında bilgilendirileceksiniz." };
  });
}

export async function updateProfileAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireCustomer();
    await updateCustomerProfile(db, ctx.customer.id, parseInput(profileSchema, formToObject(fd)));
    revalidatePath("/hesabim", "layout");
    return { status: "success", message: "Bilgileriniz kaydedildi." };
  });
}

export async function changePasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireCustomer();
    const v = parseInput(
      z
        .object({ currentPassword: z.string().min(1, "Mevcut şifre gerekli.").max(256), newPassword: passwordSchema, confirmPassword: z.string() })
        .refine((x) => x.newPassword === x.confirmPassword, { message: "Şifreler eşleşmiyor.", path: ["confirmPassword"] }),
      formToObject(fd),
    );
    await changeCustomerPassword(db, ctx.customer.id, ctx.session.id, v.currentPassword, v.newPassword);
    return { status: "success", message: "Şifreniz değiştirildi; diğer cihazlardaki oturumlar kapatıldı." };
  });
}

export async function deleteAccountAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireCustomer();
    const v = parseInput(z.object({ password: z.string().min(1, "Şifrenizi girin."), confirm: z.literal("on", { error: "Onay kutusunu işaretleyin." }) }), formToObject(fd));
    await deleteCustomerAccount(db, ctx.customer.id, v.password);
    await clearSessionCookie("CUSTOMER");
    redirect("/?hesap=silindi");
  });
}
