const fmt = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Kuruş → "1.250 ₺" */
export function formatTL(kurus: number | null | undefined): string {
  return fmt.format((kurus ?? 0) / 100);
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
