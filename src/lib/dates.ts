import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { TZ } from "./time";

/** Türkiye saatine göre bugünün tarihi (YYYY-MM-DD). */
export function todayTR(now: Date = new Date()): string {
  return format(new TZDate(now, TZ), "yyyy-MM-dd");
}

const d = (s: string) => parseISO(s);
const f = (x: Date) => format(x, "yyyy-MM-dd");

export const addMonthsStr = (s: string, n: number) => f(addMonths(d(s), n));
export const addDaysStr = (s: string, n: number) => f(addDays(d(s), n));
export const diffDays = (a: string, b: string) => differenceInCalendarDays(d(a), d(b));
export const maxDateStr = (...xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x).sort().at(-1) ?? null;

/** "2026-11-21" → "21 Kasım 2026" */
export function formatDateStr(s: string | null | undefined): string {
  if (!s) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${s}T00:00:00Z`));
}

/**
 * [başlangıç, başlangıç + n ay) aralığının SON günü (dahil). Örn. 2026-01-15 + 1 ay → 2026-02-14.
 * Deneme ve ödeme dönemleri dahil son gün olarak saklanır.
 */
export const periodEnd = (start: string, months: number) => addDaysStr(addMonthsStr(start, months), -1);

/** "2026-11-21T10:30" (Türkiye saati, datetime-local) → Date. Geçersizse null. */
export function parseLocalDateTime(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const date = new TZDate(y, mo - 1, d, h, mi, 0, TZ);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime());
}

/** Date → "2026-11-21T10:30" (Türkiye saati, datetime-local değeri) */
export function toLocalDateTimeInput(d: Date | null | undefined): string {
  if (!d) return "";
  return format(new TZDate(d, TZ), "yyyy-MM-dd'T'HH:mm");
}
