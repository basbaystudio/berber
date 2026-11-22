/** Sitenin genel adresi ve adı (SEO, e-posta bağlantıları). APP_URL canlıda https://www.dijitalberber.com olmalı. */
export const SITE_NAME = "Dijital Berber";
export function siteUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
export const SITE_DESCRIPTION =
  "Yakınındaki berberleri keşfet, hizmet ve fiyatları incele, anlık boş saatleri gör ve online berber randevusu al. Berberler için ücretsiz deneme.";
