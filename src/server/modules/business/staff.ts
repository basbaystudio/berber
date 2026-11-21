import "server-only";
import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DB, Executor } from "@/server/db/client";
import { packageItems, packageStaff, packages, services, staff, staffBreaks, staffServices, staffShifts, staffTimeOff } from "@/server/db/schema";
import { AppError, notFound } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { deleteStoredImage, processAndStoreImage } from "@/server/storage/images";
import { checkbox, optionalText, trimmed } from "@/lib/validation/common";
import { parseLocalDateTime } from "@/lib/dates";
import { shortTime, type WeeklyRanges } from "@/lib/schedule";
import { bizAudit, type Biz } from "./context";

export const staffSchema = z.object({
  name: trimmed(2, 60, "Ad soyad"),
  title: optionalText(60, "Ünvan"),
  bio: optionalText(500, "Tanıtım"),
  isActive: checkbox,
});

/** Bu işletmenin çalışanı mı? Değilse NOT_FOUND (başka işletmenin kaydının varlığı sızdırılmaz). */
async function ownStaff(db: Executor, businessId: string, id: string) {
  const [s] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.businessId, businessId), isNull(staff.deletedAt)))
    .limit(1);
  if (!s) throw notFound("Çalışan");
  return s;
}

export async function listStaff(db: Executor, businessId: string) {
  const rows = await db
    .select()
    .from(staff)
    .where(and(eq(staff.businessId, businessId), isNull(staff.deletedAt)))
    .orderBy(asc(staff.sortOrder), asc(staff.name));
  const links = await db.select().from(staffServices).where(eq(staffServices.businessId, businessId));
  return rows.map((s) => ({ ...s, serviceIds: links.filter((l) => l.staffId === s.id).map((l) => l.serviceId) }));
}

export async function getStaffDetail(db: Executor, businessId: string, id: string) {
  const s = await ownStaff(db, businessId, id);
  const [links, shifts, breaks, timeOff] = [
    await db.select().from(staffServices).where(and(eq(staffServices.businessId, businessId), eq(staffServices.staffId, id))),
    await db.select().from(staffShifts).where(and(eq(staffShifts.businessId, businessId), eq(staffShifts.staffId, id))).orderBy(asc(staffShifts.weekday), asc(staffShifts.startTime)),
    await db.select().from(staffBreaks).where(and(eq(staffBreaks.businessId, businessId), eq(staffBreaks.staffId, id))).orderBy(asc(staffBreaks.weekday), asc(staffBreaks.startTime)),
    await db
      .select()
      .from(staffTimeOff)
      .where(and(eq(staffTimeOff.businessId, businessId), eq(staffTimeOff.staffId, id), gte(staffTimeOff.endsAt, new Date())))
      .orderBy(asc(staffTimeOff.startsAt)),
  ];
  const toWeekly = (rows: { weekday: number; startTime: string; endTime: string }[]) => {
    const out: WeeklyRanges = {};
    for (const r of rows) (out[r.weekday] ??= []).push({ start: shortTime(r.startTime), end: shortTime(r.endTime) });
    return out;
  };
  return { ...s, serviceIds: links.map((l) => l.serviceId), shifts: toWeekly(shifts), breaks: toWeekly(breaks), timeOff };
}

export async function createStaff(db: DB, biz: Biz, input: z.infer<typeof staffSchema>) {
  const [s] = await db
    .insert(staff)
    .values({ businessId: biz.businessId, name: input.name, title: input.title ?? null, bio: input.bio ?? null, isActive: input.isActive })
    .returning();
  await audit(db, { ...bizAudit(biz), action: "staff.create", entity: "staff", entityId: s!.id });
  return s!;
}

export async function updateStaff(db: DB, biz: Biz, id: string, input: z.infer<typeof staffSchema>) {
  await ownStaff(db, biz.businessId, id);
  await db
    .update(staff)
    .set({ name: input.name, title: input.title ?? null, bio: input.bio ?? null, isActive: input.isActive })
    .where(and(eq(staff.id, id), eq(staff.businessId, biz.businessId)));
  await audit(db, { ...bizAudit(biz), action: "staff.update", entity: "staff", entityId: id });
}

/** Geçmiş randevularda kaldığı için kalıcı silinmez. Yetkinlik ve paket bağları kaldırılır. */
export async function deleteStaff(db: DB, biz: Biz, id: string) {
  await db.transaction(async (tx) => {
    await ownStaff(tx, biz.businessId, id);
    await tx.update(staff).set({ deletedAt: new Date(), isActive: false }).where(and(eq(staff.id, id), eq(staff.businessId, biz.businessId)));
    await tx.delete(staffServices).where(and(eq(staffServices.businessId, biz.businessId), eq(staffServices.staffId, id)));
    await tx.delete(packageStaff).where(and(eq(packageStaff.businessId, biz.businessId), eq(packageStaff.staffId, id)));
    await audit(tx, { ...bizAudit(biz), action: "staff.delete", entity: "staff", entityId: id });
  });
}

export async function setStaffPhoto(db: DB, biz: Biz, id: string, image: Buffer) {
  const cur = await ownStaff(db, biz.businessId, id);
  const img = await processAndStoreImage(image, "staff", `businesses/${biz.businessId}/staff`);
  await db.update(staff).set({ photoKey: img.key, photoUrl: img.url }).where(and(eq(staff.id, id), eq(staff.businessId, biz.businessId)));
  if (cur.photoKey && cur.photoUrl) await deleteStoredImage({ key: cur.photoKey, url: cur.photoUrl });
}

/**
 * Çalışanın verebildiği hizmetler. Çalışan bir pakette tanımlıysa ve paketin bir hizmeti listeden çıkarılıyorsa engellenir
 * (paketin tamamını tek çalışan yapar kuralı).
 */
export async function setStaffServices(db: DB, biz: Biz, id: string, serviceIds: string[]) {
  await db.transaction(async (tx) => {
    await ownStaff(tx, biz.businessId, id);
    if (serviceIds.length) {
      const own = await tx
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.businessId, biz.businessId), inArray(services.id, serviceIds), isNull(services.deletedAt)));
      if (own.length !== new Set(serviceIds).size) throw new AppError("VALIDATION", "Seçilen hizmet bulunamadı.");
    }
    const pkgs = await tx
      .select({ packageId: packages.id, name: packages.name, serviceId: packageItems.serviceId })
      .from(packageStaff)
      .innerJoin(packages, eq(packages.id, packageStaff.packageId))
      .innerJoin(packageItems, eq(packageItems.packageId, packages.id))
      .where(and(eq(packageStaff.businessId, biz.businessId), eq(packageStaff.staffId, id), isNull(packages.deletedAt)));
    const broken = [...new Set(pkgs.filter((p) => !serviceIds.includes(p.serviceId)).map((p) => p.name))];
    if (broken.length)
      throw new AppError(
        "CONFLICT",
        `Bu çalışan şu paketlerde tanımlı ve paketteki tüm hizmetleri verebilmeli: ${broken.join(", ")}. Önce çalışanı paketten çıkarın.`,
      );
    await tx.delete(staffServices).where(and(eq(staffServices.businessId, biz.businessId), eq(staffServices.staffId, id)));
    if (serviceIds.length) await tx.insert(staffServices).values(serviceIds.map((serviceId) => ({ businessId: biz.businessId, staffId: id, serviceId })));
    await audit(tx, { ...bizAudit(biz), action: "staff.services_update", entity: "staff", entityId: id, meta: { count: serviceIds.length } });
  });
}

/** Vardiya ya da tekrarlayan mola programını bütünüyle değiştirir. */
export async function setStaffWeekly(db: DB, biz: Biz, id: string, kind: "shifts" | "breaks", weekly: WeeklyRanges) {
  const table = kind === "shifts" ? staffShifts : staffBreaks;
  await db.transaction(async (tx) => {
    await ownStaff(tx, biz.businessId, id);
    await tx.delete(table).where(and(eq(table.businessId, biz.businessId), eq(table.staffId, id)));
    const rows = Object.entries(weekly).flatMap(([wd, ranges]) =>
      ranges.map((r) => ({ businessId: biz.businessId, staffId: id, weekday: Number(wd), startTime: r.start, endTime: r.end })),
    );
    if (rows.length) await tx.insert(table).values(rows);
    await audit(tx, { ...bizAudit(biz), action: `staff.${kind}_update`, entity: "staff", entityId: id });
  });
}

const dt = (label: string) =>
  z.string().transform((v, ctx) => {
    const d = parseLocalDateTime(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: `${label} seçin.` });
      return z.NEVER;
    }
    return d;
  });

export const timeOffSchema = z
  .object({
    startsAt: dt("Başlangıç"),
    endsAt: dt("Bitiş"),
    kind: z.enum(["LEAVE", "SICK", "BLOCK"]).default("LEAVE"),
    note: optionalText(120, "Not"),
  })
  .refine((v) => v.startsAt < v.endsAt, { message: "Bitiş başlangıçtan sonra olmalı.", path: ["endsAt"] })
  .refine((v) => v.endsAt.getTime() - v.startsAt.getTime() <= 366 * 86400_000, { message: "En fazla 1 yıllık izin girilebilir.", path: ["endsAt"] });

export async function addTimeOff(db: DB, biz: Biz, id: string, input: z.infer<typeof timeOffSchema>) {
  await ownStaff(db, biz.businessId, id);
  if (input.endsAt <= new Date()) throw new AppError("VALIDATION", "Geçmişte kalan izin eklenemez.", { endsAt: "Gelecekte bir tarih seçin." });
  await db.insert(staffTimeOff).values({ businessId: biz.businessId, staffId: id, ...input, note: input.note ?? null });
  await audit(db, { ...bizAudit(biz), action: "staff.time_off_add", entity: "staff", entityId: id });
}

export async function deleteTimeOff(db: DB, biz: Biz, timeOffId: string) {
  const res = await db
    .delete(staffTimeOff)
    .where(and(eq(staffTimeOff.id, timeOffId), eq(staffTimeOff.businessId, biz.businessId)))
    .returning({ id: staffTimeOff.id });
  if (!res.length) throw notFound("İzin kaydı");
}

