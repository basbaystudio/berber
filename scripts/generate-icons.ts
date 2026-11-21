/**
 * Uygulama ikonlarını logodan üretir (PWA, Apple, favicon).
 * Kaynak: public/brand/logo-isaret.png ("db" işareti, şeffaf zemin). Logo değişirse: npx tsx scripts/generate-icons.ts
 */
import sharp from "sharp";
import fs from "node:fs/promises";

const MARK = "public/brand/logo-isaret.png";

/** Beyaz zemin üzerinde ortalanmış işaret; pad = kenar boşluğu oranı. */
async function icon(file: string, size: number, pad: number, rounded = false) {
  const inner = Math.round(size * (1 - pad * 2));
  const mark = await sharp(MARK).resize(inner, inner, { fit: "inside" }).toBuffer();
  const r = rounded ? Math.round(size * 0.22) : 0;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#ffffff"/></svg>`);
  await sharp(bg).composite([{ input: mark, gravity: "center" }]).png({ compressionLevel: 9 }).toFile(file);
}

async function main() {
  await fs.mkdir("public/icons", { recursive: true });
  await icon("public/icons/icon-192.png", 192, 0.12);
  await icon("public/icons/icon-512.png", 512, 0.12);
  // Maskelenebilir: Android ikonu daire/yuvarlak keser, güvenli alan için daha geniş boşluk
  await icon("public/icons/maskable-512.png", 512, 0.22);
  await icon("src/app/apple-icon.png", 180, 0.12);
  await icon("src/app/icon.png", 64, 0.06, true);
  await fs.rm("src/app/icon.svg", { force: true });
  console.log("İkonlar üretildi.");
}

main();
