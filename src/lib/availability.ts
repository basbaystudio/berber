/**
 * Müsaitlik motoru (saf fonksiyonlar). Tüm hesaplar bir yerel günün dakikaları üzerinde yapılır: [0, 1440).
 *
 * Bir çalışan için t başlangıçlı, D dakikalık randevu şu koşullarda geçerlidir:
 *   1. [t, t+D)  ⊂  (çalışanın vardiyası ∩ işletmenin o günkü açık aralıkları)
 *   2. [t, t+D)  ∩  (molalar ∪ izinler ∪ geçici kapanış) = ∅
 *   3. [t, t+D+tampon) ∩ mevcut randevular [başlangıç, tampon sonu) = ∅   (DB'deki EXCLUDE kısıtıyla birebir aynı kural)
 *   4. t ≥ en erken izin verilen dakika (şimdi + minimum ön süre)
 */
import { TZDate } from "@date-fns/tz";
import { TZ } from "./time";
import { toMinutes, fromMinutes, type TimeRange } from "./schedule";

export type Interval = [number, number]; // [başlangıç, bitiş) dakika

export const rangesToIntervals = (rs: TimeRange[]): Interval[] => rs.map((r) => [toMinutes(r.start), toMinutes(r.end)] as Interval);

/** Aralıkları sıralar ve birleştirir. */
export function normalize(xs: Interval[]): Interval[] {
  const s = xs.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  const A = normalize(a);
  const B = normalize(b);
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const lo = Math.max(A[i]![0], B[j]![0]);
    const hi = Math.min(A[i]![1], B[j]![1]);
    if (lo < hi) out.push([lo, hi]);
    if (A[i]![1] < B[j]![1]) i++;
    else j++;
  }
  return out;
}

export function subtract(a: Interval[], b: Interval[]): Interval[] {
  let cur = normalize(a);
  for (const [bs, be] of normalize(b)) {
    const next: Interval[] = [];
    for (const [as, ae] of cur) {
      if (be <= as || bs >= ae) next.push([as, ae]);
      else {
        if (bs > as) next.push([as, bs]);
        if (be < ae) next.push([be, ae]);
      }
    }
    cur = next;
  }
  return cur;
}

const contains = (xs: Interval[], [s, e]: Interval) => xs.some(([a, b]) => a <= s && e <= b);
const overlaps = (xs: Interval[], [s, e]: Interval) => xs.some(([a, b]) => a < e && s < b);

/* ───────── Zaman dönüşümleri (Europe/Istanbul) ───────── */

/** Yerel günün başlangıcı (UTC Date). */
export function dayStartUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, TZ).getTime());
}

/** Mutlak zaman aralığını o günün dakika aralığına kırpar (gün dışındaysa null). */
export function clipToDay(date: string, start: Date, end: Date): Interval | null {
  const d0 = dayStartUtc(date).getTime();
  const d1 = d0 + 1440 * 60_000;
  const s = Math.max(start.getTime(), d0);
  const e = Math.min(end.getTime(), d1);
  if (e <= s) return null;
  return [Math.floor((s - d0) / 60_000), Math.ceil((e - d0) / 60_000)];
}

/** Yerel gün + dakika → mutlak zaman. */
export function minuteToDate(date: string, minute: number): Date {
  return new Date(dayStartUtc(date).getTime() + minute * 60_000);
}

/* ───────── Slot üretimi ───────── */

export type StaffDay = {
  staffId: string;
  shifts: Interval[];
  breaks: Interval[];
  timeOff: Interval[];
  /** Mevcut aktif randevular: [başlangıç, tampon dahil bitiş) */
  busy: Interval[];
};

export type DayInput = {
  /** İşletmenin o günkü açık aralıkları (istisnalar uygulanmış) */
  businessOpen: Interval[];
  /** Geçici kapanışın o güne düşen kısmı */
  closed: Interval[];
  staff: StaffDay[];
  durationMin: number;
  bufferMin: number;
  slotIntervalMin: number;
  /** Bu dakikadan önce başlayan slot verilmez (bugün için şimdi + ön süre; gelecek günler için 0). Gün tamamen geçmişse ≥1440. */
  earliestMinute: number;
};

export type Slot = { minute: number; time: string; staffIds: string[] };

/** Tek bir çalışan ve başlangıç dakikası için kural kontrolü. */
export function isStaffSlotValid(input: Omit<DayInput, "staff" | "slotIntervalMin">, s: StaffDay, t: number): boolean {
  if (t < input.earliestMinute) return false;
  const appt: Interval = [t, t + input.durationMin];
  const work = intersect(s.shifts, input.businessOpen);
  if (!contains(work, appt)) return false;
  if (overlaps([...s.breaks, ...s.timeOff, ...input.closed], appt)) return false;
  if (overlaps(s.busy, [t, t + input.durationMin + input.bufferMin])) return false;
  return true;
}

/** Günün tüm geçerli slotları; her slot için müsait çalışanlar. Slotlar saat başından itibaren aralık katlarıdır. */
export function computeSlots(input: DayInput): Slot[] {
  const byMinute = new Map<number, string[]>();
  const step = input.slotIntervalMin;
  for (const s of input.staff) {
    const work = subtract(intersect(s.shifts, input.businessOpen), [...s.breaks, ...s.timeOff, ...input.closed]);
    for (const [a, b] of work) {
      for (let t = Math.ceil(a / step) * step; t + input.durationMin <= b; t += step) {
        if (isStaffSlotValid(input, s, t)) byMinute.set(t, [...(byMinute.get(t) ?? []), s.staffId]);
      }
    }
  }
  return [...byMinute.entries()].sort((x, y) => x[0] - y[0]).map(([minute, staffIds]) => ({ minute, time: fromMinutes(minute), staffIds }));
}
