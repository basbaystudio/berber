import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { businessSettings } from "@/server/db/schema";
import { audit } from "@/server/lib/audit";
import { bizAudit, type Biz } from "./context";

export const bookingSettingsSchema = z.object({
  slotIntervalMin: z.coerce.number().refine((n) => [5, 10, 15, 20, 30, 60].includes(n), "Geçersiz aralık."),
  minLeadMin: z.coerce.number().int().min(0, "0 veya daha büyük olmalı.").max(10080, "En fazla 7 gün (10080 dk)."),
  maxAdvanceDays: z.coerce.number().int().min(1, "En az 1 gün.").max(365, "En fazla 365 gün."),
  bufferMin: z.coerce.number().int().min(0).max(120, "En fazla 120 dakika."),
});

export async function getBookingSettings(db: Executor, businessId: string) {
  const [s] = await db.select().from(businessSettings).where(eq(businessSettings.businessId, businessId));
  return s!;
}

export async function updateBookingSettings(db: DB, biz: Biz, input: z.infer<typeof bookingSettingsSchema>) {
  await db.update(businessSettings).set(input).where(eq(businessSettings.businessId, biz.businessId));
  await audit(db, { ...bizAudit(biz), action: "business.booking_settings_update", meta: input });
}
