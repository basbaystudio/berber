import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/server/db/client";
import { businesses, portfolioPhotos, staffServices } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import type { Biz } from "@/server/modules/business/context";
import { deletePackage, deleteService, listServices, savePackage, saveService } from "@/server/modules/business/catalog";
import { addTimeOff, createStaff, deleteStaff, deleteTimeOff, getStaffDetail, setStaffServices, setStaffWeekly, updateStaff } from "@/server/modules/business/staff";
import { addExceptions, deleteException, getBusinessOpenState, getExceptionMap, getWeeklyHours, setWeeklyHours } from "@/server/modules/business/hours";
import { createCategory, deletePhoto, getPortfolio, updatePhotoMeta, uploadPhoto } from "@/server/modules/business/portfolio";
import { getPublishChecklist } from "@/server/modules/business/publish";
import { addDaysStr, todayTR } from "@/lib/dates";
import { makeAdmin, makeBusiness } from "../helpers/factory";

async function twoBusinesses() {
  const admin = await makeAdmin();
  const a = await makeBusiness(admin.id);
  const b = await makeBusiness(admin.id);
  const A: Biz = { businessId: a.businessId, userId: a.userId };
  const B: Biz = { businessId: b.businessId, userId: b.userId };
  return { A, B };
}

async function code(p: Promise<unknown>) {
  return p.then(() => "OK", (e) => (e instanceof AppError ? e.code : String(e)));
}

const svc = (name: string, staffIds: string[] = [], durationMin = 30) => ({
  name,
  description: undefined,
  serviceTypeId: undefined,
  priceKurus: 40000,
  durationMin,
  isActive: true,
  staffIds,
});

describe("işletmeler arası veri izolasyonu (uygulama katmanı)", () => {
  it("başka işletmenin çalışanı okunamaz, düzenlenemez, silinemez", async () => {
    const { A, B } = await twoBusinesses();
    const sB = await createStaff(db, B, { name: "B Usta", title: undefined, bio: undefined, isActive: true });
    expect(await code(getStaffDetail(db, A.businessId, sB.id))).toBe("NOT_FOUND");
    expect(await code(updateStaff(db, A, sB.id, { name: "Hack", title: undefined, bio: undefined, isActive: true }))).toBe("NOT_FOUND");
    expect(await code(setStaffWeekly(db, A, sB.id, "shifts", { 1: [{ start: "09:00", end: "10:00" }] }))).toBe("NOT_FOUND");
    expect(await code(setStaffServices(db, A, sB.id, []))).toBe("NOT_FOUND");
    expect(await code(addTimeOff(db, A, sB.id, { startsAt: new Date(Date.now() + 86400e3), endsAt: new Date(Date.now() + 2 * 86400e3), kind: "LEAVE", note: undefined }))).toBe("NOT_FOUND");
    expect(await code(deleteStaff(db, A, sB.id))).toBe("NOT_FOUND");
    expect((await getStaffDetail(db, B.businessId, sB.id)).name).toBe("B Usta");
  });

  it("başka işletmenin hizmeti/paketi/izni/istisnası/fotoğrafı değiştirilemez", async () => {
    const { A, B } = await twoBusinesses();
    const sB = await createStaff(db, B, { name: "B", title: undefined, bio: undefined, isActive: true });
    const svcB = await saveService(db, B, null, svc("B Kesim", [sB.id]));
    const svcB2 = await saveService(db, B, null, svc("B Sakal", [sB.id]));
    const pkgB = await savePackage(db, B, null, { name: "B Paket", description: undefined, priceKurus: 1, durationMin: undefined, isActive: true, serviceIds: [svcB, svcB2], staffIds: [sB.id] });
    expect(await code(saveService(db, A, svcB, svc("Hack")))).toBe("NOT_FOUND");
    expect(await code(deleteService(db, A, svcB))).toBe("NOT_FOUND");
    expect(await code(deletePackage(db, A, pkgB))).toBe("NOT_FOUND");
    // A, B'nin çalışanını kendi hizmetine atayamaz
    expect(await code(saveService(db, A, null, svc("A Kesim", [sB.id])))).toBe("VALIDATION");
    // A, B'nin hizmetleriyle paket kuramaz
    expect(await code(savePackage(db, A, null, { name: "X", description: undefined, priceKurus: 1, durationMin: undefined, isActive: true, serviceIds: [svcB, svcB2], staffIds: [] }))).toBe("VALIDATION");

    await addTimeOff(db, B, sB.id, { startsAt: new Date(Date.now() + 86400e3), endsAt: new Date(Date.now() + 2 * 86400e3), kind: "LEAVE", note: undefined });
    const offId = (await getStaffDetail(db, B.businessId, sB.id)).timeOff[0]!.id;
    expect(await code(deleteTimeOff(db, A, offId))).toBe("NOT_FOUND");

    const day = addDaysStr(todayTR(), 3);
    await addExceptions(db, B, { startDate: day, kind: "CLOSED", reason: "OTHER", ranges: [], note: undefined });
    const exId = (await getExceptionMap(db, B.businessId, day, day))[day]!.id;
    expect(await code(deleteException(db, A, exId))).toBe("NOT_FOUND");
    expect(Object.keys(await getExceptionMap(db, A.businessId, day, day))).toHaveLength(0);
  });
});

describe("hizmet, paket ve çalışan kuralları", () => {
  it("paket çalışanı paketteki tüm hizmetlere yetkin olmalı; süre boşsa toplam alınır", async () => {
    const { A } = await twoBusinesses();
    const s1 = await createStaff(db, A, { name: "Usta 1", title: undefined, bio: undefined, isActive: true });
    const s2 = await createStaff(db, A, { name: "Usta 2", title: undefined, bio: undefined, isActive: true });
    const kesim = await saveService(db, A, null, svc("Kesim", [s1.id, s2.id], 30));
    const sakal = await saveService(db, A, null, svc("Sakal", [s1.id], 20));
    const input = { name: "Kesim + Sakal", description: undefined, priceKurus: 60000, durationMin: undefined, isActive: true, serviceIds: [kesim, sakal] };
    expect(await code(savePackage(db, A, null, { ...input, staffIds: [s2.id] }))).toBe("VALIDATION");
    const pkg = await savePackage(db, A, null, { ...input, staffIds: [s1.id] });
    const [row] = await db.select().from(businesses).where(eq(businesses.id, A.businessId));
    expect(row!.minPriceKurus).toBe(40000);
    // Pakette kullanılan hizmet silinemez; paketteki çalışanın yetkinliği daraltılamaz
    expect(await code(deleteService(db, A, sakal))).toBe("CONFLICT");
    expect(await code(setStaffServices(db, A, s1.id, [kesim]))).toBe("CONFLICT");
    await deletePackage(db, A, pkg);
    await deleteService(db, A, sakal);
    expect((await listServices(db, A.businessId)).map((s) => s.name)).toEqual(["Kesim"]);
    // Silinen çalışanın yetkinlikleri kaldırılır
    await deleteStaff(db, A, s2.id);
    expect(await db.select().from(staffServices).where(and(eq(staffServices.staffId, s2.id)))).toHaveLength(0);
  });

  it("çalışma saatleri, istisna ve yayın kontrol listesi", async () => {
    const { A } = await twoBusinesses();
    await setWeeklyHours(db, A, { 1: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "19:00" }], 6: [{ start: "10:00", end: "16:00" }] });
    expect((await getWeeklyHours(db, A.businessId))[1]).toHaveLength(2);
    expect(await code(addExceptions(db, A, { startDate: addDaysStr(todayTR(), -1), kind: "CLOSED", reason: "OTHER", ranges: [], note: undefined }))).toBe("VALIDATION");
    const from = addDaysStr(todayTR(), 5);
    await addExceptions(db, A, { startDate: from, endDate: addDaysStr(from, 2), kind: "CUSTOM_HOURS", reason: "SPECIAL", ranges: [{ start: "10:00", end: "14:00" }], note: "Kısa gün" });
    const map = await getExceptionMap(db, A.businessId, from, addDaysStr(from, 2));
    expect(Object.keys(map)).toHaveLength(3);
    expect(map[from]!.ranges).toEqual([{ start: "10:00", end: "14:00" }]);
    // Aynı güne tekrar ekleme eskisinin yerine geçer
    await addExceptions(db, A, { startDate: from, kind: "CLOSED", reason: "HOLIDAY", ranges: [], note: undefined });
    expect((await getExceptionMap(db, A.businessId, from, from))[from]!.kind).toBe("CLOSED");
    const state = await getBusinessOpenState(db, A.businessId);
    expect(typeof state.isOpen).toBe("boolean");

    const s = await createStaff(db, A, { name: "U", title: undefined, bio: undefined, isActive: true });
    await saveService(db, A, null, svc("Kesim", [s.id]));
    const checks = Object.fromEntries((await getPublishChecklist(db, A.businessId)).map((c) => [c.key, c.ok]));
    expect(checks).toMatchObject({ hours: true, staff: true, services: true, location: false });
  });
});

describe("portfolyo", () => {
  const png = () => sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 120, g: 90, b: 60 } } }).png().toBuffer();

  it("görsel WebP'ye çevrilir, metadata saklanır; görsel olmayan dosya reddedilir", async () => {
    const { A } = await twoBusinesses();
    const r = await uploadPhoto(db, A, await png(), { caption: "İlk iş", categoryId: undefined, staffId: undefined });
    expect(r.photo.mime).toBe("image/webp");
    expect(r.photo.width).toBe(400);
    expect(r.used).toBe(1);
    expect(await code(uploadPhoto(db, A, Buffer.from("<script>alert(1)</script>"), {} as never))).toBe("VALIDATION");
    const small = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#000" } }).png().toBuffer();
    expect(await code(uploadPhoto(db, A, small, {} as never))).toBe("VALIDATION");
  });

  it("30 limiti eşzamanlı yüklemede de aşılmaz; silme hakkı geri verir", async () => {
    const { A } = await twoBusinesses();
    await db.update(businesses).set({ photoCount: 28 }).where(eq(businesses.id, A.businessId));
    const img = await png();
    const results = await Promise.all(Array.from({ length: 6 }, () => code(uploadPhoto(db, A, img, {} as never))));
    expect(results.filter((r) => r === "OK")).toHaveLength(2);
    expect(results.filter((r) => r === "LIMIT_REACHED")).toHaveLength(4);
    const p = await getPortfolio(db, A.businessId);
    expect(p.used).toBe(30);
    expect(p.photos).toHaveLength(2);
    await deletePhoto(db, A, p.photos[0]!.id);
    expect((await getPortfolio(db, A.businessId)).used).toBe(29);
  });

  it("başka işletmenin fotoğrafı/kategorisi kullanılamaz", async () => {
    const { A, B } = await twoBusinesses();
    const { photo } = await uploadPhoto(db, B, await png(), {} as never);
    expect(await code(deletePhoto(db, A, photo.id))).toBe("NOT_FOUND");
    expect(await code(updatePhotoMeta(db, A, photo.id, { caption: "x", categoryId: undefined, staffId: undefined }))).toBe("NOT_FOUND");
    await createCategory(db, B, "B Kategori");
    const catB = (await getPortfolio(db, B.businessId)).categories[0]!.id;
    const { photo: pa } = await uploadPhoto(db, A, await png(), {} as never);
    expect(await code(updatePhotoMeta(db, A, pa.id, { caption: undefined, categoryId: catB, staffId: undefined }))).toBe("VALIDATION");
    expect(await db.select().from(portfolioPhotos).where(eq(portfolioPhotos.id, photo.id))).toHaveLength(1);
  });
});
