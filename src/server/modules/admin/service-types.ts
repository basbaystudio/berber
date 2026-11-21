import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { serviceTypes } from "@/server/db/schema";
import { AppError, notFound, pgErrorCode, PG } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { slugify } from "@/lib/slug";
import { checkbox, trimmed } from "@/lib/validation/common";
import type { AdminActor } from "./businesses";

export const serviceTypeSchema = z.object({
  name: trimmed(2, 60, "Hizmet türü adı"),
  sortOrder: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(999)),
  isActive: checkbox,
});

export function listServiceTypes(db: Executor) {
  return db.select().from(serviceTypes).orderBy(asc(serviceTypes.sortOrder), asc(serviceTypes.name));
}

const dup = () => new AppError("CONFLICT", "Bu isimde bir hizmet türü zaten var.", { name: "Bu isim kullanılıyor." });

export async function createServiceType(db: DB, actor: AdminActor, input: z.infer<typeof serviceTypeSchema>) {
  try {
    const [row] = await db
      .insert(serviceTypes)
      .values({ name: input.name, slug: slugify(input.name), sortOrder: input.sortOrder, isActive: input.isActive })
      .returning();
    await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "service_type.create", entity: "service_type", entityId: row!.id, ip: actor.ip });
    return row!;
  } catch (e) {
    if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw dup();
    throw e;
  }
}

export async function updateServiceType(db: DB, actor: AdminActor, id: string, input: z.infer<typeof serviceTypeSchema>) {
  try {
    const res = await db
      .update(serviceTypes)
      .set({ name: input.name, slug: slugify(input.name), sortOrder: input.sortOrder, isActive: input.isActive })
      .where(eq(serviceTypes.id, id))
      .returning({ id: serviceTypes.id });
    if (!res.length) throw notFound("Hizmet türü");
    await audit(db, { actorRealm: "ADMIN", actorId: actor.adminId, action: "service_type.update", entity: "service_type", entityId: id, ip: actor.ip });
  } catch (e) {
    if (pgErrorCode(e) === PG.UNIQUE_VIOLATION) throw dup();
    throw e;
  }
}
