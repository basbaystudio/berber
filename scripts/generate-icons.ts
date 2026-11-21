/**
 * Uygulama ikonlarını üretir (PWA, Apple, favicon). Tasarım değişirse: npx tsx scripts/generate-icons.ts
 * Mürekkep zemin üzerinde pirinç tonlu makas işareti.
 */
import sharp from "sharp";
import fs from "node:fs/promises";

const INK = "#1c1917";
const BRASS = "#c9a46a";

function svg(size: number, padRatio: number, rounded: boolean) {
  const r = rounded ? size * 0.22 : 0;
  const s = size * (1 - padRatio * 2);
  const o = size * padRatio;
  // 24×24 makas ikonu (lucide "scissors" çizgileri)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${INK}"/>
  <g transform="translate(${o} ${o}) scale(${s / 24})" fill="none" stroke="${BRASS}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>
  </g>
</svg>`;
}

async function png(file: string, size: number, pad: number, rounded = false) {
  await sharp(Buffer.from(svg(size, pad, rounded))).png({ compressionLevel: 9 }).toFile(file);
}

async function main() {
  await fs.mkdir("public/icons", { recursive: true });
  await png("public/icons/icon-192.png", 192, 0.2);
  await png("public/icons/icon-512.png", 512, 0.2);
  // Maskelenebilir: güvenli alan için daha geniş boşluk
  await png("public/icons/maskable-512.png", 512, 0.28);
  await png("src/app/apple-icon.png", 180, 0.18);
  await fs.writeFile("src/app/icon.svg", svg(64, 0.16, true));
  console.log("İkonlar üretildi.");
}

main();
