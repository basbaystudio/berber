const whole = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kuruş → "₺1.250" ya da "₺699,90" (kuruş varsa iki hane) */
export function formatTL(kurus: number | null | undefined): string {
  const k = kurus ?? 0;
  return (k % 100 === 0 ? whole : cents).format(k / 100);
}

/** "900", "899,90", "1.250,50", "1250.5" → kuruş. Geçersizse null. */
export function parseTLToKurus(input: string): number | null {
  let s = input.trim().replace(/\s|₺|TL/gi, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Kuruş → form alanı için "899,90" / "900" */
export function kurusToInput(kurus: number | null | undefined): string {
  if (kurus == null) return "";
  return kurus % 100 === 0 ? String(kurus / 100) : (kurus / 100).toFixed(2).replace(".", ",");
}
