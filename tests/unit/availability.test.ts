import { describe, expect, it } from "vitest";
import { clipToDay, computeSlots, intersect, isStaffSlotValid, minuteToDate, normalize, subtract, type DayInput, type StaffDay } from "@/lib/availability";

const H = (h: number, m = 0) => h * 60 + m;
const staff = (id: string, over: Partial<StaffDay> = {}): StaffDay => ({ staffId: id, shifts: [[H(9), H(18)]], breaks: [], timeOff: [], busy: [], ...over });
const base = (over: Partial<DayInput> = {}): DayInput => ({
  businessOpen: [[H(9), H(19)]],
  closed: [],
  staff: [staff("a")],
  durationMin: 30,
  bufferMin: 0,
  slotIntervalMin: 15,
  earliestMinute: 0,
  ...over,
});
const times = (i: DayInput, id?: string) => computeSlots(i).filter((s) => !id || s.staffIds.includes(id)).map((s) => s.time);

describe("aralık cebiri", () => {
  it("birleştirme, kesişim, çıkarma", () => {
    expect(normalize([[10, 20], [5, 12], [30, 40]])).toEqual([[5, 20], [30, 40]]);
    expect(intersect([[0, 100]], [[10, 20], [90, 120]])).toEqual([[10, 20], [90, 100]]);
    expect(subtract([[0, 100]], [[10, 20], [50, 60]])).toEqual([[0, 10], [20, 50], [60, 100]]);
    expect(subtract([[0, 100]], [[0, 100]])).toEqual([]);
  });
});

describe("slot üretimi", () => {
  it("vardiya ∩ işletme saatleri; bitişe sığmayan slot yok", () => {
    const t = times(base());
    expect(t[0]).toBe("09:00");
    expect(t.at(-1)).toBe("17:30"); // vardiya 18:00'de bitiyor, 30 dk
    expect(t).not.toContain("17:45");
  });

  it("işletme kapalıyken (vardiya olsa da) slot yok; işletme açık ama vardiya yoksa slot yok", () => {
    expect(times(base({ businessOpen: [] }))).toEqual([]);
    expect(times(base({ staff: [staff("a", { shifts: [] })] }))).toEqual([]);
    // Vardiya işletme saatinden geniş: yalnızca kesişim
    expect(times(base({ businessOpen: [[H(12), H(13)]] }))).toEqual(["12:00", "12:15", "12:30"]);
  });

  it("mola ve izin aralıklarına denk gelen slot verilmez", () => {
    const i = base({ staff: [staff("a", { breaks: [[H(13), H(14)]], timeOff: [[H(16), H(18)]] })] });
    const t = times(i);
    expect(t).toContain("12:30");
    expect(t).not.toContain("12:45"); // 12:45–13:15 molaya taşar
    expect(t).not.toContain("13:30");
    expect(t).toContain("14:00");
    expect(t.at(-1)).toBe("15:30");
  });

  it("mevcut randevu ve tampon süre", () => {
    const busy: [number, number][] = [[H(10), H(10, 40)]]; // 10:00–10:30 + 10 dk tampon
    const t = times(base({ staff: [staff("a", { busy })], bufferMin: 10 }));
    expect(t).toContain("09:15"); // 09:15–09:45 +10 → 09:55 < 10:00
    expect(t).not.toContain("09:30"); // 09:30–10:00 +10 → 10:10 çakışır
    expect(t).not.toContain("10:30"); // tampon 10:40'a kadar
    expect(t).toContain("10:45");
  });

  it("paket gibi uzun süreler", () => {
    const t = times(base({ durationMin: 90 }));
    expect(t.at(-1)).toBe("16:30");
  });

  it("geçici kapanış ve en erken başlangıç", () => {
    expect(times(base({ closed: [[0, H(12)]] }))[0]).toBe("12:00");
    expect(times(base({ earliestMinute: H(11, 5) }))[0]).toBe("11:15");
    expect(times(base({ earliestMinute: 1440 }))).toEqual([]);
  });

  it("birden çok çalışan: slot başına müsait çalışan listesi", () => {
    const s = computeSlots(base({ staff: [staff("a", { busy: [[H(9), H(10)]] }), staff("b", { shifts: [[H(9), H(12)]] })] }));
    expect(s.find((x) => x.time === "09:00")!.staffIds).toEqual(["b"]);
    expect(s.find((x) => x.time === "10:00")!.staffIds.sort()).toEqual(["a", "b"]);
    expect(s.find((x) => x.time === "13:00")!.staffIds).toEqual(["a"]);
  });

  it("ızgara dışı (panel) başlangıç kontrolü", () => {
    const i = base();
    expect(isStaffSlotValid(i, staff("a"), H(9, 5))).toBe(true);
    expect(isStaffSlotValid(i, staff("a"), H(17, 35))).toBe(false);
  });
});

describe("zaman dönüşümleri (Türkiye saati)", () => {
  it("yerel gün dakikası ↔ mutlak zaman", () => {
    expect(minuteToDate("2030-01-07", H(9)).toISOString()).toBe("2030-01-07T06:00:00.000Z");
    expect(clipToDay("2030-01-07", new Date("2030-01-07T06:00:00Z"), new Date("2030-01-07T06:30:00Z"))).toEqual([H(9), H(9, 30)]);
    // Önceki günden taşan izin kırpılır
    expect(clipToDay("2030-01-07", new Date("2030-01-05T00:00:00Z"), new Date("2030-01-07T09:00:00Z"))).toEqual([0, H(12)]);
    expect(clipToDay("2030-01-07", new Date("2030-01-08T00:00:00Z"), new Date("2030-01-09T00:00:00Z"))).toBeNull();
  });
});
