export const TZ = "Europe/Istanbul";

const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, dateStyle: "medium" });

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}
