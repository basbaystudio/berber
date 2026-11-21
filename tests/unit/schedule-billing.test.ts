import { describe, expect, it } from "vitest";
import { computeOpenState, dayRangesSchema, weeklyRangesSchema, type OpenStateInput } from "@/lib/schedule";
import { computeSubscriptionStatus } from "@/server/modules/billing/status";
import { formatTL, parseTLToKurus, kurusToInput } from "@/lib/money";
import { periodEnd, todayTR, parseLocalDateTime } from "@/lib/dates";

// 2030-01-07 Pazartesi. Türkiye UTC+3.
const at = (local: string) => new Date(`${local}+03:00`);
const base: OpenStateInput = {
  weekly: { 1: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "19:00" }], 6: [{ start: "10:00", end: "16:00" }] },
  exceptions: {},
  tempClosedUntil: null,
};

describe("açık/kapalı durumu", () => {
  it("çalışma aralığında AÇIK", () => {
    const s = computeOpenState(base, at("2030-01-07T10:00:00"));
    expect(s).toMatchObject({ isOpen: true, detail: "Kapanış 12:00" });
  });
  it("öğle arasında KAPALI ve aynı gün açılışı gösterir", () => {
    expect(computeOpenState(base, at("2030-01-07T12:30:00"))).toMatchObject({ isOpen: false, detail: "Açılış bugün 13:00" });
  });
  it("aralık bitişi dahil değildir", () => {
    expect(computeOpenState(base, at("2030-01-07T19:00:00")).isOpen).toBe(false);
    expect(computeOpenState(base, at("2030-01-07T18:59:00")).isOpen).toBe(true);
  });
  it("kapalı günde bir sonraki açılışı bulur", () => {
    // Salı → Cumartesi 10:00
    expect(computeOpenState(base, at("2030-01-08T10:00:00")).detail).toBe("Açılış Cumartesi 10:00");
    // Pazar → yarın (Pazartesi)
    expect(computeOpenState(base, at("2030-01-13T10:00:00")).detail).toBe("Açılış yarın 09:00");
  });
  it("istisna günü haftalık programı ezer", () => {
    const closed = { ...base, exceptions: { "2030-01-07": { kind: "CLOSED" as const, ranges: [] } } };
    expect(computeOpenState(closed, at("2030-01-07T10:00:00")).isOpen).toBe(false);
    const custom = { ...base, exceptions: { "2030-01-08": { kind: "CUSTOM_HOURS" as const, ranges: [{ start: "11:00", end: "14:00" }] } } };
    expect(computeOpenState(custom, at("2030-01-08T12:00:00")).isOpen).toBe(true);
  });
  it("geçici kapanış her şeyi ezer", () => {
    const s = computeOpenState({ ...base, tempClosedUntil: at("2030-01-09T00:00:00") }, at("2030-01-07T10:00:00"));
    expect(s).toMatchObject({ isOpen: false, label: "Geçici olarak kapalı" });
    expect(computeOpenState({ ...base, tempClosedUntil: at("2030-01-07T09:30:00") }, at("2030-01-07T10:00:00")).isOpen).toBe(true);
  });
  it("UTC'de farklı gün olsa da Türkiye saatine göre hesaplar", () => {
    // 2030-01-06 22:30 UTC = 2030-01-07 01:30 TR (Pazartesi gecesi)
    expect(computeOpenState(base, new Date("2030-01-06T22:30:00Z")).detail).toBe("Açılış bugün 09:00");
  });
});

describe("saat aralığı doğrulaması", () => {
  it("çakışan aralıkları reddeder, sıralar", () => {
    expect(dayRangesSchema.safeParse([{ start: "09:00", end: "13:00" }, { start: "12:00", end: "15:00" }]).success).toBe(false);
    const r = dayRangesSchema.parse([{ start: "14:00", end: "18:00" }, { start: "09:00", end: "12:00" }]);
    expect(r[0]!.start).toBe("09:00");
  });
  it("ters aralık ve 5 dk dışı saat reddedilir", () => {
    expect(dayRangesSchema.safeParse([{ start: "10:00", end: "09:00" }]).success).toBe(false);
    expect(dayRangesSchema.safeParse([{ start: "09:03", end: "10:00" }]).success).toBe(false);
    expect(dayRangesSchema.safeParse([{ start: "25:00", end: "26:00" }]).success).toBe(false);
  });
  it("haftalık JSON'u ayrıştırır, geçersiz gün anahtarını reddeder", () => {
    expect(weeklyRangesSchema.safeParse(JSON.stringify({ 1: [{ start: "09:00", end: "18:00" }] })).success).toBe(true);
    expect(weeklyRangesSchema.safeParse(JSON.stringify({ 8: [{ start: "09:00", end: "18:00" }] })).success).toBe(false);
    expect(weeklyRangesSchema.safeParse("bozuk").success).toBe(false);
  });
});

describe("abonelik durumu", () => {
  const sub = (trialEndsOn: string | null, paidThrough: string | null = null) => ({ trialEndsOn, paidThrough, cancelledAt: null });
  it("ücretlendirme kapalıysa her zaman ücretsiz dönem", () => {
    expect(computeSubscriptionStatus(sub("2020-01-01"), false, "2030-01-01").kind).toBe("FREE_PERIOD");
  });
  it("deneme, ödendi ve gecikme", () => {
    expect(computeSubscriptionStatus(sub("2030-03-31"), true, "2030-03-31")).toMatchObject({ kind: "TRIAL", days: 1 });
    expect(computeSubscriptionStatus(sub("2030-03-31"), true, "2030-04-01")).toMatchObject({ kind: "PAST_DUE", days: 1 });
    expect(computeSubscriptionStatus(sub("2030-03-31", "2030-04-30"), true, "2030-04-10").kind).toBe("PAID");
    expect(computeSubscriptionStatus(sub("2030-03-31", "2030-04-30"), true, "2030-05-05")).toMatchObject({ kind: "PAST_DUE", days: 5 });
  });
  it("iptal edilmiş", () => {
    expect(computeSubscriptionStatus({ trialEndsOn: null, paidThrough: null, cancelledAt: new Date() }, true, "2030-01-01").kind).toBe("CANCELLED");
  });
  it("dönem sonu: 1 ay = ertesi ayın bir önceki günü", () => {
    expect(periodEnd("2030-01-15", 1)).toBe("2030-02-14");
    expect(periodEnd("2030-01-01", 3)).toBe("2030-03-31");
    expect(periodEnd("2030-01-31", 1)).toBe("2030-02-27"); // 31 Ocak + 1 ay = 28 Şubat; son kapsanan gün 27 Şubat
  });
});

describe("para ve tarih", () => {
  it.each([
    ["900", 90000],
    ["899,90", 89990],
    ["1.250,50", 125050],
    ["1.250", 125000],
    ["1250.5", 125050],
    ["₺ 45", 4500],
  ])("%s → %i kuruş", (s, k) => expect(parseTLToKurus(s)).toBe(k));
  it.each(["", "abc", "1,2,3", "-5", "12,345"])("geçersiz: %s", (s) => expect(parseTLToKurus(s)).toBeNull());
  it("form değerine çevirir", () => {
    expect(kurusToInput(90000)).toBe("900");
    expect(kurusToInput(89990)).toBe("899,90");
  });
  it("Türkiye saatine göre bugün ve datetime-local", () => {
    expect(todayTR(new Date("2030-01-06T21:30:00Z"))).toBe("2030-01-07");
    expect(parseLocalDateTime("2030-01-07T10:30")?.toISOString()).toBe("2030-01-07T07:30:00.000Z");
    expect(parseLocalDateTime("bozuk")).toBeNull();
  });
});

import { needsPaymentSetup } from "@/server/modules/billing/status";

describe("ödeme penceresi (kapatılamaz) koşulu", () => {
  const base = { trialEndsOn: "2030-03-31", paidThrough: null, cancelledAt: null, autoRenew: false, cardLast4: null };
  it("ücretlendirme kapalıyken ya da deneme sürerken gösterilmez", () => {
    expect(needsPaymentSetup(base, false, "2030-05-01")).toBe(false);
    expect(needsPaymentSetup(base, true, "2030-03-31")).toBe(false);
  });
  it("deneme bitti, kart yok → gösterilir", () => {
    expect(needsPaymentSetup(base, true, "2030-04-01")).toBe(true);
  });
  it("kartla otomatik ödeme kuruluysa ya da dönem ödenmişse gösterilmez", () => {
    expect(needsPaymentSetup({ ...base, autoRenew: true, cardLast4: "4242" }, true, "2030-04-01")).toBe(false);
    expect(needsPaymentSetup({ ...base, paidThrough: "2030-04-30" }, true, "2030-04-10")).toBe(false);
    expect(needsPaymentSetup({ ...base, paidThrough: "2030-04-30" }, true, "2030-05-01")).toBe(true);
  });
});

import { trustScore, trustReasons } from "@/lib/trust";

describe("güven puanı", () => {
  const w = { confirmation: 0.4, responseSpeed: 0.2, businessCancellation: 0.2, closure: 0.1, activity: 0.1 };
  const prior = { score: 70, fullConfidenceSamples: 10 };
  const base = { decided: 0, expired: 0, medianResponseMin: null, confirmed: 0, cancelledAfterConfirm: 0, resolved: 0, unresolved: 0, daysSinceActivity: 0 };
  it("verisi olmayan yeni işletme başlangıç puanına yakındır", () => {
    expect(trustScore(base, w, prior).score).toBeCloseTo(73, 0); // 0.9*70 + 0.1*100
  });
  it("hızlı yanıt veren, iptal etmeyen işletme yüksek; taleplerini kaçıran düşük puan alır", () => {
    const good = trustScore({ ...base, decided: 20, medianResponseMin: 10, confirmed: 20, resolved: 15 }, w, prior).score;
    const bad = trustScore({ ...base, decided: 5, expired: 15, medianResponseMin: 300, confirmed: 5, cancelledAfterConfirm: 2, resolved: 1, unresolved: 4, daysSinceActivity: 12 }, w, prior).score;
    expect(good).toBeGreaterThan(95);
    expect(bad).toBeLessThan(40);
  });
  it("gerekçeler", () => {
    const r = trustReasons({ ...base, expired: 3, unresolved: 2, daysSinceActivity: 9 });
    expect(r.map((x) => x.text).join(" ")).toMatch(/3 randevu talebi.*2 geçmiş randevu.*9 gün/s);
  });
});

describe("formatTL", () => {
  it("kuruş varsa iki hane, yoksa tam sayı gösterir", () => {
    const n = (s: string) => s.replace(/\s/g, " ");
    expect(n(formatTL(69990))).toBe("₺699,90");
    expect(n(formatTL(699000))).toBe("₺6.990");
    expect(n(formatTL(45050))).toBe("₺450,50");
    expect(n(formatTL(0))).toBe("₺0");
  });
});
