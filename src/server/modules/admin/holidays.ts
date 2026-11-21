import "server-only";
import { asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { publicHolidays } from "@/server/db/schema";
import { audit } from "@/server/lib/audit";
import { checkbox, trimmed } from "@/lib/validation/common";
import { todayTR } from "@/lib/dates";

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih seçin."),
  name: trimmed(2, 80, "Tatil adı"),
  isHalfDay: checkbox,
});

export function listHolidays(db: Executor, fromDate = todayTR()) {
  return db.select().from(publicHolidays).where(gte(publicHolidays.date, fromDate)).orderBy(asc(publicHolidays.date));
}

export async function upsertHoliday(db: DB, actor: { adminId: string; ip?: string | null }, input: z.infer<typeof holidaySchema>) {
  await db
    .insert(publicHolidays)
    .values(input)
    .onConflictDoUpdate({ target: publicHolidays.date, set: { name: input.name, isHalfDay: input.isHalfDay } });
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "holiday.upsert", entity: "holiday", entityId: input.date, ip: actor.ip });
}

export async function deleteHoliday(db: DB, actor: { adminId: string; ip?: string | null }, date: string) {
  await db.delete(publicHolidays).where(eq(publicHolidays.date, date));
  await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "holiday.delete", entity: "holiday", entityId: date, ip: actor.ip });
}
