import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { appointments, businessHours, businesses, staffServices, services } from "@/server/db/schema";
import { pgErrorCode, PG } from "@/server/lib/errors";
import { rawBusiness, rawBusinessCustomer, rawStaff } from "../helpers/factory";

const T = (iso: string) => new Date(iso);

async function code(p: Promise<unknown>) {
  return p.then(() => "OK", (e) => pgErrorCode(e) ?? String(e));
}

async function setup() {
  const b = await rawBusiness();
  const s = await rawStaff(b.id);
  const c = await rawBusinessCustomer(b.id);
  const appt = (start: string, end: string, extra: Partial<typeof appointments.$inferInsert> = {}) =>
    db.insert(appointments).values({
      businessId: b.id,
      staffId: s.id,
      businessCustomerId: c.id,
      startsAt: T(start),
      endsAt: T(end),
      blockedUntil: T(end),
      status: "CONFIRMED",
      source: "PANEL",
      totalKurus: 50000,
      ...extra,
    }).returning();
  return { b, s, c, appt };
}

describe("randevu çakışma koruması (EXCLUDE kısıtı)", () => {
  it("aynı çalışana örtüşen iki aktif randevu yazılamaz", async () => {
    const { appt } = await setup();
    expect(await code(appt("2030-01-07T09:00:00Z", "2030-01-07T09:30:00Z"))).toBe("OK");
    expect(await code(appt("2030-01-07T09:15:00Z", "2030-01-07T09:45:00Z"))).toBe(PG.EXCLUSION_VIOLATION);
    expect(await code(appt("2030-01-07T08:45:00Z", "2030-01-07T10:00:00Z"))).toBe(PG.EXCLUSION_VIOLATION);
    expect(await code(appt("2030-01-07T09:00:00Z", "2030-01-07T09:30:00Z", { status: "PENDING" }))).toBe(PG.EXCLUSION_VIOLATION);
  });

  it("uç uca eklenen randevular çakışma sayılmaz", async () => {
    const { appt } = await setup();
    expect(await code(appt("2030-01-07T09:00:00Z", "2030-01-07T09:30:00Z"))).toBe("OK");
    expect(await code(appt("2030-01-07T09:30:00Z", "2030-01-07T10:00:00Z"))).toBe("OK");
    expect(await code(appt("2030-01-07T08:30:00Z", "2030-01-07T09:00:00Z"))).toBe("OK");
  });

  it("tampon süre (blocked_until) de korunur", async () => {
    const { appt } = await setup();
    expect(await code(appt("2030-01-07T09:00:00Z", "2030-01-07T09:30:00Z", { blockedUntil: T("2030-01-07T09:40:00Z") }))).toBe("OK");
    expect(await code(appt("2030-01-07T09:35:00Z", "2030-01-07T10:00:00Z"))).toBe(PG.EXCLUSION_VIOLATION);
  });

  it("iptal edilen randevunun saati yeniden kullanılabilir", async () => {
    const { appt } = await setup();
    const [first] = await appt("2030-01-07T11:00:00Z", "2030-01-07T11:30:00Z");
    await db.update(appointments).set({ status: "CANCELLED", cancelledAt: new Date(), cancelReason: "CUSTOMER" }).where(eq(appointments.id, first!.id));
    expect(await code(appt("2030-01-07T11:00:00Z", "2030-01-07T11:30:00Z"))).toBe("OK");
  });

  it("iptal edilmiş bir randevu, dolu bir saate geri alınamaz", async () => {
    const { appt } = await setup();
    const [first] = await appt("2030-01-07T12:00:00Z", "2030-01-07T12:30:00Z");
    await db.update(appointments).set({ status: "CANCELLED", cancelledAt: new Date(), cancelReason: "CUSTOMER" }).where(eq(appointments.id, first!.id));
    await appt("2030-01-07T12:00:00Z", "2030-01-07T12:30:00Z");
    expect(
      await code(db.update(appointments).set({ status: "CONFIRMED", cancelledAt: null, cancelReason: null }).where(eq(appointments.id, first!.id))),
    ).toBe(PG.EXCLUSION_VIOLATION);
  });

  it("farklı çalışanlar aynı saatte randevu alabilir", async () => {
    const { b, c, appt } = await setup();
    const s2 = await rawStaff(b.id, "İkinci Usta");
    await appt("2030-01-07T13:00:00Z", "2030-01-07T13:30:00Z");
    expect(await code(appt("2030-01-07T13:00:00Z", "2030-01-07T13:30:00Z", { staffId: s2.id, businessCustomerId: c.id }))).toBe("OK");
  });

  it("eşzamanlı 20 istekten yalnızca biri aynı slotu alır", async () => {
    const { appt } = await setup();
    const results = await Promise.all(Array.from({ length: 20 }, () => code(appt("2030-01-08T10:00:00Z", "2030-01-08T10:45:00Z"))));
    expect(results.filter((r) => r === "OK")).toHaveLength(1);
    expect(results.filter((r) => r === PG.EXCLUSION_VIOLATION)).toHaveLength(19);
  });

  it("online randevu müşteri hesabı olmadan yazılamaz", async () => {
    const { appt } = await setup();
    expect(await code(appt("2030-01-09T10:00:00Z", "2030-01-09T10:30:00Z", { source: "ONLINE", customerId: null }))).toBe(PG.CHECK_VIOLATION);
  });
});

describe("işletmeler arası veri izolasyonu (bileşik yabancı anahtar)", () => {
  it("bir işletmenin randevusu başka işletmenin çalışanına bağlanamaz", async () => {
    const a = await setup();
    const other = await rawBusiness();
    const foreignStaff = await rawStaff(other.id);
    expect(await code(a.appt("2030-02-01T10:00:00Z", "2030-02-01T10:30:00Z", { staffId: foreignStaff.id }))).toBe(PG.FOREIGN_KEY_VIOLATION);
  });

  it("bir işletmenin randevusu başka işletmenin müşteri kaydını kullanamaz", async () => {
    const a = await setup();
    const other = await rawBusiness();
    const foreignCustomer = await rawBusinessCustomer(other.id);
    expect(await code(a.appt("2030-02-01T11:00:00Z", "2030-02-01T11:30:00Z", { businessCustomerId: foreignCustomer.id }))).toBe(PG.FOREIGN_KEY_VIOLATION);
  });

  it("çalışana başka işletmenin hizmeti atanamaz", async () => {
    const a = await setup();
    const other = await rawBusiness();
    const [svc] = await db.insert(services).values({ businessId: other.id, name: "Kesim", priceKurus: 40000, durationMin: 30 }).returning();
    expect(await code(db.insert(staffServices).values({ businessId: a.b.id, staffId: a.s.id, serviceId: svc!.id }))).toBe(PG.FOREIGN_KEY_VIOLATION);
    expect(await code(db.insert(staffServices).values({ businessId: other.id, staffId: a.s.id, serviceId: svc!.id }))).toBe(PG.FOREIGN_KEY_VIOLATION);
  });
});

describe("diğer veritabanı kısıtları", () => {
  it("portfolyo sayacı 30'u aşamaz", async () => {
    const b = await rawBusiness();
    expect(await code(db.update(businesses).set({ photoCount: 30 }).where(eq(businesses.id, b.id)))).toBe("OK");
    expect(await code(db.update(businesses).set({ photoCount: 31 }).where(eq(businesses.id, b.id)))).toBe(PG.CHECK_VIOLATION);
  });

  it("aynı gün içinde çalışma aralıkları örtüşemez", async () => {
    const b = await rawBusiness();
    const h = (start: string, end: string, weekday = 1) => db.insert(businessHours).values({ businessId: b.id, weekday, startTime: start, endTime: end });
    expect(await code(h("09:00", "13:00"))).toBe("OK");
    expect(await code(h("14:00", "19:00"))).toBe("OK");
    expect(await code(h("12:00", "15:00"))).toBe(PG.EXCLUSION_VIOLATION);
    expect(await code(h("12:00", "15:00", 2))).toBe("OK");
    expect(await code(h("10:00", "09:00", 3))).toBe(PG.CHECK_VIOLATION);
  });

  it("hizmet süresi 5 dakikanın katı ve fiyat negatif olmayan olmalı", async () => {
    const b = await rawBusiness();
    const s = (priceKurus: number, durationMin: number) => db.insert(services).values({ businessId: b.id, name: "X", priceKurus, durationMin });
    expect(await code(s(10000, 30))).toBe("OK");
    expect(await code(s(10000, 32))).toBe(PG.CHECK_VIOLATION);
    expect(await code(s(-1, 30))).toBe(PG.CHECK_VIOLATION);
  });
});
