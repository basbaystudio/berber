/**
 * Çalışma saatleri için saf (yan etkisiz) yardımcılar. Hem işletme saatleri hem çalışan vardiyaları ve
 * molaları için kullanılır; Aşama 4'teki müsaitlik algoritmasının temelidir.
 * Saatler gün içindeki dakika olarak işlenir (09:30 → 570). weekday: 1=Pazartesi … 7=Pazar.
 */
import { z } from "zod";
import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { TZ } from "./time";

export type TimeRange = { start: string; end: string }; // "HH:MM"
export type WeeklyRanges = Record<number, TimeRange[]>; // 1..7

export const WEEKDAYS = [
  { value: 1, label: "Pazartesi", short: "Pzt" },
  { value: 2, label: "Salı", short: "Sal" },
  { value: 3, label: "Çarşamba", short: "Çar" },
  { value: 4, label: "Perşembe", short: "Per" },
  { value: 5, label: "Cuma", short: "Cum" },
  { value: 6, label: "Cumartesi", short: "Cmt" },
  { value: 7, label: "Pazar", short: "Paz" },
] as const;

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
export const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
/** DB'den gelen "09:00:00" → "09:00" */
export const shortTime = (t: string) => t.slice(0, 5);

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalı.")
  .refine((t) => toMinutes(t) % 5 === 0, "Saatler 5 dakikanın katı olmalı.");

export const timeRangeSchema = z.object({ start: hhmm, end: hhmm }).refine((r) => toMinutes(r.start) < toMinutes(r.end), "Bitiş saati başlangıçtan sonra olmalı.");

/** Aynı gün içindeki aralıklar sıralı ve örtüşmesiz olmalı. */
export const dayRangesSchema = z
  .array(timeRangeSchema)
  .max(6, "Bir gün için en fazla 6 aralık tanımlanabilir.")
  .transform((rs) => [...rs].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)))
  .refine((rs) => rs.every((r, i) => i === 0 || toMinutes(rs[i - 1]!.end) <= toMinutes(r.start)), "Aynı gün içindeki aralıklar çakışmamalı.");

/** Formdan JSON olarak gelen haftalık program: { "1": [{start,end}], ... } */
export const weeklyRangesSchema = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  },
  z.record(z.string().regex(/^[1-7]$/), dayRangesSchema, { error: "Geçersiz program." }),
);

/* ───────── Türkiye saatine göre an ───────── */

export type LocalMoment = { date: string; weekday: number; minutes: number };

export function localMoment(now: Date): LocalMoment {
  const z = new TZDate(now, TZ);
  const dow = z.getDay(); // 0=Pazar
  return { date: format(z, "yyyy-MM-dd"), weekday: dow === 0 ? 7 : dow, minutes: z.getHours() * 60 + z.getMinutes() };
}

function shiftDate(date: string, days: number): { date: string; weekday: number } {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const base = addDays(new Date(Date.UTC(y, m - 1, d, 12)), days);
  const dow = base.getUTCDay();
  return { date: base.toISOString().slice(0, 10), weekday: dow === 0 ? 7 : dow };
}

/* ───────── Açık / kapalı ───────── */

export type DayException = { kind: "CLOSED" | "CUSTOM_HOURS"; ranges: TimeRange[]; note?: string | null };

export type OpenStateInput = {
  weekly: WeeklyRanges;
  /** tarih (YYYY-MM-DD) → istisna */
  exceptions: Record<string, DayException>;
  tempClosedUntil: Date | null;
};

export type OpenState = { isOpen: boolean; label: string; detail?: string };

/** Belirli bir gün için geçerli aralıklar (istisna varsa o, yoksa haftalık). */
export function rangesForDay(input: OpenStateInput, date: string, weekday: number): TimeRange[] {
  const ex = input.exceptions[date];
  if (ex) return ex.kind === "CLOSED" ? [] : ex.ranges;
  return input.weekly[weekday] ?? [];
}

const DAY_NAMES = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/**
 * İşletmenin şu anki durumu. Çalışma saatleri dışında otomatik KAPALI, içinde AÇIK.
 * Not: İşletmenin açık olması tüm çalışanların müsait olduğu anlamına gelmez (müsaitlik ayrıca hesaplanır).
 */
export function computeOpenState(input: OpenStateInput, now: Date): OpenState {
  const m = localMoment(now);
  if (input.tempClosedUntil && input.tempClosedUntil > now) {
    const until = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(input.tempClosedUntil);
    return { isOpen: false, label: "Geçici olarak kapalı", detail: `${until} tarihine kadar` };
  }
  const today = rangesForDay(input, m.date, m.weekday);
  const current = today.find((r) => toMinutes(r.start) <= m.minutes && m.minutes < toMinutes(r.end));
  if (current) return { isOpen: true, label: "Açık", detail: `Kapanış ${current.end}` };

  // Bir sonraki açılış (bugünün kalanı + 14 gün)
  const laterToday = today.find((r) => toMinutes(r.start) > m.minutes);
  if (laterToday) return { isOpen: false, label: "Kapalı", detail: `Açılış bugün ${laterToday.start}` };
  for (let i = 1; i <= 14; i++) {
    const d = shiftDate(m.date, i);
    if (input.tempClosedUntil && input.tempClosedUntil > new Date(`${d.date}T23:59:59+03:00`)) continue;
    const rs = rangesForDay(input, d.date, d.weekday);
    if (rs.length) return { isOpen: false, label: "Kapalı", detail: `Açılış ${i === 1 ? "yarın" : DAY_NAMES[d.weekday]} ${rs[0]!.start}` };
  }
  return { isOpen: false, label: "Kapalı" };
}

/** Tarih aralığındaki günler (dahil), en fazla `max` gün. */
export function datesBetween(from: string, to: string, max = 62): string[] {
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const d = shiftDate(from, i).date;
    if (d > to) break;
    out.push(d);
  }
  return out;
}
