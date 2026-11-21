/**
 * Türkiye telefon numarasını +90XXXXXXXXXX biçimine çevirir. Geçersizse null.
 * Kabul: 0532 123 45 67, 532 123 45 67, +90 532..., 0212 123 45 67 vb.
 */
export function normalizeTrPhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0090")) d = d.slice(4);
  else if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.length !== 10 || !/^[2-58]/.test(d)) return null;
  return `+90${d}`;
}

/** +905321234567 → 0532 123 45 67 */
export function formatTrPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const d = e164.replace(/^\+90/, "");
  if (d.length !== 10) return e164;
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}
