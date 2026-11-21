"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { favorites, businesses } from "@/server/db/schema";
import { getCustomer, requireCustomer } from "@/server/auth/guards";
import { enforce, RATE_LIMITS } from "@/server/auth/rate-limit";
import { AppError } from "@/server/lib/errors";
import { runAction, type ActionState } from "@/server/lib/action";
import { getRequestMeta } from "@/server/lib/request";
import { dateSchema, getAvailableSlots, selectionSchema } from "@/server/modules/booking/availability";
import { createAppointment } from "@/server/modules/booking/service";
import { publicCondition } from "@/server/modules/marketplace/search";
import { minuteToDate } from "@/lib/availability";
import { toMinutes } from "@/lib/schedule";

async function publicBusinessId(slug: string) {
  const [b] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.slug, z.string().max(80).parse(slug)), publicCondition));
  if (!b) throw new AppError("NOT_FOUND", "İşletme bulunamadı.");
  return b.id;
}

export type PublicSlots = { slots: { time: string; staffIds: string[] }[]; durationMin: number; totalKurus: number } | { error: string };

/** Herkese açık müsait saatler (giriş gerekmez). IP bazlı hız sınırı. */
export async function getPublicSlotsAction(slug: string, input: { date: string; serviceIds: string[]; packageId?: string; staffId?: string | null }): Promise<PublicSlots> {
  try {
    await enforce(db, `slots:ip:${(await getRequestMeta()).ip}`, { limit: 300, windowSec: 600 });
    const businessId = await publicBusinessId(slug);
    const r = await getAvailableSlots(db, businessId, {
      date: dateSchema.parse(input.date),
      selection: selectionSchema.parse({ serviceIds: input.serviceIds ?? [], packageId: input.packageId || undefined }),
      staffId: input.staffId ? z.string().uuid().parse(input.staffId) : null,
      mode: "ONLINE",
    });
    return { slots: r.slots.map((s) => ({ time: s.time, staffIds: s.staffIds })), durationMin: r.durationMin, totalKurus: r.totalKurus };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: "Geçersiz seçim." };
    throw e;
  }
}

const bookSchema = z.object({
  date: dateSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/, "Saat seçin."),
  serviceIds: z.array(z.string().uuid()).max(10).default([]),
  packageId: z.string().uuid().optional(),
  staffId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().uuid(),
});

/**
 * Online randevu. YALNIZCA giriş yapmış ve e-postası doğrulanmış müşteri.
 * Misafir için başka bir randevu yolu yoktur.
 */
export async function bookOnlineAction(slug: string, input: z.input<typeof bookSchema>): Promise<ActionState<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireCustomer();
    if (!ctx.customer.emailVerified) throw new AppError("FORBIDDEN", "Randevu alabilmek için önce e-posta adresinizi doğrulayın.");
    await enforce(db, `booking:${ctx.customer.id}`, RATE_LIMITS.booking);
    const v = bookSchema.parse(input);
    const businessId = await publicBusinessId(slug);
    const a = await createAppointment(db, {
      businessId,
      mode: "ONLINE",
      actor: { realm: "CUSTOMER", id: ctx.customer.id, ip: (await getRequestMeta()).ip },
      customer: { customerId: ctx.customer.id },
      selection: selectionSchema.parse({ serviceIds: v.serviceIds, packageId: v.packageId }),
      staffId: v.staffId ?? null,
      startsAt: minuteToDate(v.date, toMinutes(v.time)),
      customerNote: v.note || null,
      idempotencyKey: `${ctx.customer.id}:${v.idempotencyKey}`,
    });
    updateTag(`availability:${businessId}`);
    redirect(`/hesabim/randevular?yeni=${a.id}`);
  });
}

/** Favoriye ekle/çıkar (giriş gerekli). */
type FavResult = { favorite: boolean; loginRequired?: boolean };
export async function toggleFavoriteAction(slug: string): Promise<ActionState<FavResult>> {
  return runAction<FavResult>(async () => {
    const ctx = await getCustomer();
    if (!ctx) return { status: "success", data: { favorite: false, loginRequired: true } };
    const businessId = await publicBusinessId(slug);
    const [ex] = await db.select().from(favorites).where(and(eq(favorites.customerId, ctx.customer.id), eq(favorites.businessId, businessId)));
    if (ex) await db.delete(favorites).where(and(eq(favorites.customerId, ctx.customer.id), eq(favorites.businessId, businessId)));
    else await db.insert(favorites).values({ customerId: ctx.customer.id, businessId }).onConflictDoNothing();
    revalidatePath("/hesabim/favoriler");
    return { status: "success", data: { favorite: !ex } };
  });
}
