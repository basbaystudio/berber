const fmt = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Kuruş → "1.250 ₺" */
export function formatTL(kurus: number | null | undefined): string {
  return fmt.format((kurus ?? 0) / 100);
}
