/** Giriş sonrası dönüş adresi: yalnızca site içi göreli yollar (açık yönlendirme saldırısına karşı). */
export function safeNext(v: unknown, fallback = "/hesabim"): string {
  if (typeof v !== "string") return fallback;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 1000) return fallback;
  if (/^\/(admin|isletme)(\/|$)/.test(v)) return fallback;
  return v;
}
