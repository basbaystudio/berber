import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { appointments, businessCustomers, businesses, customers, notifications } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { hashPassword } from "@/server/auth/password";
import type { Biz } from "@/server/modules/business/context";
import { setWeeklyHours } from "@/server/modules/business/hours";
import { createStaff, setStaffWeekly } from "@/server/modules/business/staff";
import { saveService, savePackage } from "@/server/modules/business/catalog";
import { getAvailableSlots } from "@/server/modules/booking/availability";
import {
  cancelByBusiness,
  cancelByCustomer,
  confirmAppointment,
  createAppointment,
  expireOverduePendings,
  finalizeAppointment,
  rescheduleAppointment,
} from "@/server/modules/booking/service";
import { listPendingRequests } from "@/server/modules/booking/queries";
import { minuteToDate } from "@/lib/availability";
import { addDaysStr, todayTR } from "@/lib/dates";
import { makeAdmin, makeBusiness, uid } from "../helpers/factory";

const ALL_WEEK = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ start: "09:00", end: "19:00" }]]));
const DAY = addDaysStr(todayTR(), 3);
const at = (hhmm: string, date = DAY) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return minuteToDate(date, h * 60 + m);
};
const err = (p: Promise<unknown>) => p.then(() => "OK", (e) => (e instanceof AppError ? e.code : String(e)));

let adminId = "";
async function setupBusiness(staffCount = 1) {
  const b = await makeBusiness(adminId);
  const biz: Biz = { businessId: b.businessId, userId: b.userId };
  await setWeeklyHours(db, biz, ALL_WEEK);
  const staffIds: string[] = [];
  for (let i = 0; i < staffCount; i++) {
    const s = await createStaff(db, biz, { name: `Usta ${i + 1}`, title: undefined, bio: undefined, isActive: true });
    await setStaffWeekly(db, biz, s.id, "shifts", ALL_WEEK);
    await setStaffWeekly(db, biz, s.id, "breaks", Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ start: "13:00", end: "14:00" }]])));
    staffIds.push(s.id);
  }
  const kesim = await saveService(db, biz, null, { name: "Kesim", description: undefined, serviceTypeId: undefined, priceKurus: 45000, durationMin: 30, isActive: true, staffIds });
  const sakal = await saveService(db, biz, null, { name: "Sakal", description: undefined, serviceTypeId: undefined, priceKurus: 25000, durationMin: 20, isActive: true, staffIds });
  await db.update(businesses).set({ status: "ACTIVE" }).where(eq(businesses.id, b.businessId));
  await db.update(businesses).set({ isPublished: true }).where(eq(businesses.id, b.businessId));
  return { ...b, biz, staffIds, kesim, sakal };
}

async function makeCustomer() {
  const [c] = await db
    .insert(customers)
    .values({ name: `Müşteri ${uid()}`, email: `m-${uid()}@test.local`, phone: "+905551234567", passwordHash: await hashPassword("Musteri2026x"), kvkkConsentAt: new Date(), emailVerifiedAt: new Date() })
    .returning();
  return c!;
}

const online = (b: Awaited<ReturnType<typeof setupBusiness>>, customerId: string, start: Date, extra: Partial<Parameters<typeof createAppointment>[1]> = {}) =>
  createAppointment(db, {
    businessId: b.businessId,
    mode: "ONLINE",
    actor: { realm: "CUSTOMER", id: customerId },
    customer: { customerId },
    selection: { serviceIds: [b.kesim] },
    staffId: b.staffIds[0]!,
    startsAt: start,
    ...extra,
  });

beforeAll(async () => {
  adminId = (await makeAdmin()).id;
});

describe("müsait saatler", () => {
  it("işletme/vardiya/mola ve hizmet süresine göre hesaplanır; çoklu hizmette süreler toplanır", async () => {
    const b = await setupBusiness();
    const r = await getAvailableSlots(db, b.businessId, { date: DAY, selection: { serviceIds: [b.kesim, b.sakal] }, mode: "ONLINE" });
    expect(r.durationMin).toBe(50);
    expect(r.totalKurus).toBe(70000);
    const times = r.slots.map((s) => s.time);
    expect(times[0]).toBe("09:00");
    expect(times).toContain("12:00"); // 12:00–12:50
    expect(times).not.toContain("12:15"); // 12:15–13:05 molaya taşar
    expect(times).toContain("14:00");
    expect(times.at(-1)).toBe("18:00"); // 18:00–18:50
    // Geçmiş gün ve ufuk dışı
    expect((await getAvailableSlots(db, b.businessId, { date: addDaysStr(todayTR(), -1), selection: { serviceIds: [b.kesim] }, mode: "ONLINE" })).slots).toEqual([]);
    expect((await getAvailableSlots(db, b.businessId, { date: addDaysStr(todayTR(), 40), selection: { serviceIds: [b.kesim] }, mode: "ONLINE" })).slots).toEqual([]);
  });

  it("paket süresi ve paket çalışanı", async () => {
    const b = await setupBusiness(2);
    const pkg = await savePackage(db, b.biz, null, { name: "İkili", description: undefined, priceKurus: 60000, durationMin: 60, isActive: true, serviceIds: [b.kesim, b.sakal], staffIds: [b.staffIds[1]!] });
    const r = await getAvailableSlots(db, b.businessId, { date: DAY, selection: { packageId: pkg, serviceIds: [] }, mode: "ONLINE" });
    expect(r.durationMin).toBe(60);
    expect(r.slots.every((s) => s.staffIds.length === 1 && s.staffIds[0] === b.staffIds[1])).toBe(true);
  });
});

describe("online randevu", () => {
  it("üyelik zorunlu; bekliyor olarak oluşur; onay süresi ve bildirimler", async () => {
    const b = await setupBusiness();
    const c = await makeCustomer();
    expect(
      await err(createAppointment(db, { businessId: b.businessId, mode: "ONLINE", actor: { realm: null, id: null }, customer: { guest: { name: "X" } }, selection: { serviceIds: [b.kesim] }, staffId: null, startsAt: at("10:00") })),
    ).toBe("UNAUTHENTICATED");
    const a = await online(b, c.id, at("10:00"));
    expect(a.status).toBe("PENDING");
    expect(a.source).toBe("ONLINE");
    expect(a.totalKurus).toBe(45000);
    const expected = Math.min(Date.now() + 6 * 3600_000, at("10:00").getTime());
    expect(Math.abs(a.confirmDeadline!.getTime() - expected)).toBeLessThan(10_000);
    const mails = await db.select().from(notifications).where(eq(notifications.appointmentId, a.id));
    const tpl = (await db.select().from(notifications).where(eq(notifications.businessId, b.businessId))).map((n) => n.template);
    expect(tpl).toEqual(expect.arrayContaining(["appointment.requestReceived", "appointment.newRequestForBusiness"]));
    void mails;
    // İşletme CRM kaydı müşteri hesabına bağlanır
    const [bc] = await db.select().from(businessCustomers).where(and(eq(businessCustomers.businessId, b.businessId), eq(businessCustomers.customerId, c.id)));
    expect(bc?.displayName).toBe(c.name);
    // Panelde "onay bekleyenler" listesi
    const pending = await listPendingRequests(db, b.businessId);
    expect(pending.map((p) => p.id)).toContain(a.id);
  });

  it("ızgara dışı, geçmiş ve yayında olmayan işletme reddedilir", async () => {
    const b = await setupBusiness();
    const c = await makeCustomer();
    expect(await err(online(b, c.id, at("10:05")))).toBe("VALIDATION");
    expect(await err(online(b, c.id, at("10:00", addDaysStr(todayTR(), -1))))).toBe("CONFLICT");
    expect(await err(online(b, c.id, at("13:15")))).toBe("CONFLICT"); // mola
    await db.update(businesses).set({ isPublished: false }).where(eq(businesses.id, b.businessId));
    expect(await err(online(b, c.id, at("10:00")))).toBe("VALIDATION");
  });

  it("aynı slota eşzamanlı 10 talepten yalnızca biri başarılı olur", async () => {
    const b = await setupBusiness();
    const cs = await Promise.all(Array.from({ length: 10 }, () => makeCustomer()));
    const results = await Promise.all(cs.map((c) => err(online(b, c.id, at("11:00")))));
    expect(results.filter((r) => r === "OK")).toHaveLength(1);
    expect(results.filter((r) => r === "CONFLICT")).toHaveLength(9);
  });

  it("çalışan seçilmezse müsait diğer çalışana atanır", async () => {
    const b = await setupBusiness(2);
    const [c1, c2, c3] = [await makeCustomer(), await makeCustomer(), await makeCustomer()];
    const a1 = await online(b, c1.id, at("15:00"), { staffId: null });
    const a2 = await online(b, c2.id, at("15:00"), { staffId: null });
    expect(new Set([a1.staffId, a2.staffId]).size).toBe(2);
    expect(await err(online(b, c3.id, at("15:00"), { staffId: null }))).toBe("CONFLICT");
  });

  it("aynı istek anahtarıyla tekrar gönderim ikinci randevu oluşturmaz", async () => {
    const b = await setupBusiness();
    const c = await makeCustomer();
    const key = `idem-${uid()}`;
    const [x, y] = await Promise.all([online(b, c.id, at("16:00"), { idempotencyKey: key }), online(b, c.id, at("16:00"), { idempotencyKey: key })]);
    expect(x.id).toBe(y.id);
  });

  it("onay süresi dolan talep slotu bırakır, iptal olur ve müşteriye bildirilir; süre dolunca onaylanamaz", async () => {
    const b = await setupBusiness();
    const [c1, c2] = [await makeCustomer(), await makeCustomer()];
    const a = await online(b, c1.id, at("17:00"));
    await db.update(appointments).set({ confirmDeadline: new Date(Date.now() - 1000) }).where(eq(appointments.id, a.id));
    expect(await err(confirmAppointment(db, b.businessId, a.id, { realm: "BUSINESS", id: b.userId }))).toBe("CONFLICT");
    const slots = await getAvailableSlots(db, b.businessId, { date: DAY, selection: { serviceIds: [b.kesim] }, mode: "ONLINE" });
    expect(slots.slots.map((s) => s.time)).toContain("17:00");
    const a2 = await online(b, c2.id, at("17:00"));
    expect(a2.status).toBe("PENDING");
    const [old] = await db.select().from(appointments).where(eq(appointments.id, a.id));
    expect(old).toMatchObject({ status: "CANCELLED", cancelReason: "NOT_CONFIRMED_IN_TIME" });
    expect((await db.select().from(notifications).where(eq(notifications.dedupeKey, `appt:expired:${a.id}:1`)))).toHaveLength(1);
    expect(await expireOverduePendings(db, { businessId: b.businessId })).toBe(0);
  });
});

describe("panel ve durum geçişleri", () => {
  it("panelden hesapsız müşteriye onaylı randevu; aynı telefon aynı müşteri kaydı", async () => {
    const b = await setupBusiness();
    const mk = (t: string) =>
      createAppointment(db, { businessId: b.businessId, mode: "PANEL", actor: { realm: "BUSINESS", id: b.userId }, customer: { guest: { name: "Kapıdan Ali", phone: "+905321112233" } }, selection: { serviceIds: [b.kesim] }, staffId: b.staffIds[0]!, startsAt: at(t) });
    const a1 = await mk("09:00");
    const a2 = await mk("09:30");
    expect(a1.status).toBe("CONFIRMED");
    expect(a1.businessCustomerId).toBe(a2.businessCustomerId);
    expect(a1.customerId).toBeNull();
    // Panel ızgara dışı (5 dk katı) saate izin verir
    expect((await mk("10:05")).status).toBe("CONFIRMED");
  });

  it("onay, ret, iptal ve saat yeniden müsait", async () => {
    const b = await setupBusiness();
    const [c1, c2] = [await makeCustomer(), await makeCustomer()];
    const a = await online(b, c1.id, at("12:00"));
    await confirmAppointment(db, b.businessId, a.id, { realm: "BUSINESS", id: b.userId });
    expect((await db.select().from(appointments).where(eq(appointments.id, a.id)))[0]!.status).toBe("CONFIRMED");
    await cancelByBusiness(db, b.businessId, a.id, { realm: "BUSINESS", id: b.userId }, "Usta hastalandı");
    expect((await online(b, c2.id, at("12:00"))).status).toBe("PENDING");
  });

  it("müşteri 2 saatten az kala iptal edemez; fazlaysa edebilir; başkasının randevusunu iptal edemez", async () => {
    const b = await setupBusiness();
    const [c1, c2] = [await makeCustomer(), await makeCustomer()];
    const a = await online(b, c1.id, at("10:30"));
    expect(await err(cancelByCustomer(db, c2.id, a.id, { realm: "CUSTOMER", id: c2.id }))).toBe("NOT_FOUND");
    await cancelByCustomer(db, c1.id, a.id, { realm: "CUSTOMER", id: c1.id });
    expect((await db.select().from(appointments).where(eq(appointments.id, a.id)))[0]).toMatchObject({ status: "CANCELLED", cancelReason: "CUSTOMER" });
    // 1 saat sonrası için randevu (doğrudan DB'ye) → iptal reddedilir
    const soon = await online(b, c1.id, at("11:30"));
    await db
      .update(appointments)
      .set({ startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 5400_000), blockedUntil: new Date(Date.now() + 5400_000) })
      .where(eq(appointments.id, soon.id));
    expect(await err(cancelByCustomer(db, c1.id, soon.id, { realm: "CUSTOMER", id: c1.id }))).toBe("VALIDATION");
  });

  it("tamamlandı / gelmedi yalnızca saati geçmiş onaylı randevuda; ziyaret sayısı artar", async () => {
    const b = await setupBusiness();
    const a = await createAppointment(db, { businessId: b.businessId, mode: "PANEL", actor: { realm: "BUSINESS", id: b.userId }, customer: { guest: { name: "Veli" } }, selection: { serviceIds: [b.kesim] }, staffId: b.staffIds[0]!, startsAt: at("09:00") });
    expect(await err(finalizeAppointment(db, b.businessId, a.id, "COMPLETED", { realm: "BUSINESS", id: b.userId }))).toBe("VALIDATION");
    const past = new Date(Date.now() - 2 * 3600_000);
    await db.update(appointments).set({ startsAt: past, endsAt: new Date(past.getTime() + 1800_000), blockedUntil: new Date(past.getTime() + 1800_000) }).where(eq(appointments.id, a.id));
    await finalizeAppointment(db, b.businessId, a.id, "COMPLETED", { realm: "BUSINESS", id: b.userId });
    const [bc] = await db.select().from(businessCustomers).where(eq(businessCustomers.id, a.businessCustomerId));
    expect(bc?.visitCount).toBe(1);
    expect(await err(finalizeAppointment(db, b.businessId, a.id, "NO_SHOW", { realm: "BUSINESS", id: b.userId }))).toBe("CONFLICT");
  });

  it("tarih değiştirme: boş saate olur, dolu saate olmaz; müşteri değiştirirse yeniden onaya düşer", async () => {
    const b = await setupBusiness();
    const [c1, c2] = [await makeCustomer(), await makeCustomer()];
    const a = await online(b, c1.id, at("10:00"));
    await confirmAppointment(db, b.businessId, a.id, { realm: "BUSINESS", id: b.userId });
    await online(b, c2.id, at("11:00"));
    expect(await err(rescheduleAppointment(db, { businessId: b.businessId }, a.id, { startsAt: at("11:00") }, { realm: "BUSINESS", id: b.userId }))).toBe("CONFLICT");
    await rescheduleAppointment(db, { businessId: b.businessId }, a.id, { startsAt: at("15:00") }, { realm: "BUSINESS", id: b.userId });
    expect((await db.select().from(appointments).where(eq(appointments.id, a.id)))[0]).toMatchObject({ status: "CONFIRMED", startsAt: at("15:00") });
    // Kendi eski saatiyle çakışma sayılmaz (aynı aralığa kaydırma)
    await rescheduleAppointment(db, { businessId: b.businessId }, a.id, { startsAt: at("15:15") }, { realm: "BUSINESS", id: b.userId });
    await rescheduleAppointment(db, { customerId: c1.id }, a.id, { startsAt: at("16:00") }, { realm: "CUSTOMER", id: c1.id });
    expect((await db.select().from(appointments).where(eq(appointments.id, a.id)))[0]!.status).toBe("PENDING");
  });

  it("işletmeler birbirinin randevusunu göremez/değiştiremez", async () => {
    const A = await setupBusiness();
    const B = await setupBusiness();
    const c = await makeCustomer();
    const a = await online(A, c.id, at("10:00"));
    const actor = { realm: "BUSINESS" as const, id: B.userId };
    expect(await err(confirmAppointment(db, B.businessId, a.id, actor))).toBe("NOT_FOUND");
    expect(await err(cancelByBusiness(db, B.businessId, a.id, actor))).toBe("NOT_FOUND");
    expect(await err(rescheduleAppointment(db, { businessId: B.businessId }, a.id, { startsAt: at("12:00") }, actor))).toBe("NOT_FOUND");
    // B, A'nın müşteri kaydıyla randevu oluşturamaz
    expect(
      await err(createAppointment(db, { businessId: B.businessId, mode: "PANEL", actor, customer: { businessCustomerId: a.businessCustomerId }, selection: { serviceIds: [B.kesim] }, staffId: B.staffIds[0]!, startsAt: at("10:00") })),
    ).toBe("VALIDATION");
    // B, A'nın hizmetiyle randevu oluşturamaz
    expect(
      await err(createAppointment(db, { businessId: B.businessId, mode: "PANEL", actor, customer: { guest: { name: "X" } }, selection: { serviceIds: [A.kesim] }, staffId: null, startsAt: at("10:00") })),
    ).toBe("VALIDATION");
  });
});
