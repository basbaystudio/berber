import "server-only";
import { randomBytes } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { AppError } from "@/server/lib/errors";
import { getStorage, type StoredFile } from ".";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel istek sınırı 4,5 MB; istemci önce küçültür
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);

export type ImagePreset = "portfolio" | "banner" | "logo" | "cover" | "staff";

const PRESETS: Record<ImagePreset, { width: number; height?: number; fit: "inside" | "cover"; quality: number }> = {
  portfolio: { width: 1600, height: 1600, fit: "inside", quality: 82 },
  banner: { width: 2400, height: 1000, fit: "inside", quality: 82 },
  cover: { width: 2000, height: 900, fit: "inside", quality: 80 },
  logo: { width: 512, height: 512, fit: "cover", quality: 85 },
  staff: { width: 512, height: 512, fit: "cover", quality: 85 },
};

export type ProcessedImage = StoredFile & { width: number; height: number; sizeBytes: number; mime: string };

/** Form'dan gelen dosyayı alır; boyut ve içerik doğrulaması yapar. Uzantıya/MIME'a değil, gerçek içeriğe bakılır. */
export async function readUpload(value: FormDataEntryValue | null, label = "Görsel"): Promise<Buffer> {
  if (!value || typeof value === "string" || value.size === 0) throw new AppError("VALIDATION", `${label} seçin.`, { file: `${label} seçin.` });
  if (value.size > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "Görsel en fazla 4 MB olabilir.", { file: "Görsel en fazla 4 MB olabilir." });
  return Buffer.from(await value.arrayBuffer());
}

/**
 * Görseli doğrular, EXIF yönüne göre döndürür, boyutlandırır, WebP'ye çevirir (EXIF/GPS dahil tüm metadata silinir)
 * ve depolamaya yazar.
 */
export async function processAndStoreImage(input: Buffer, preset: ImagePreset, keyPrefix: string): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new AppError("VALIDATION", "Dosya geçerli bir görsel değil.", { file: "Dosya geçerli bir görsel değil." });
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format))
    throw new AppError("VALIDATION", "Yalnızca JPEG, PNG veya WebP görseller yüklenebilir.", { file: "Desteklenmeyen dosya türü." });
  if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200)
    throw new AppError("VALIDATION", "Görsel en az 200×200 piksel olmalı.", { file: "Görsel çok küçük." });

  const p = PRESETS[preset];
  const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: p.width, height: p.height, fit: p.fit, withoutEnlargement: p.fit === "inside" })
    .webp({ quality: p.quality })
    .toBuffer({ resolveWithObject: true });

  const key = `${keyPrefix}/${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.webp`;
  const stored = await getStorage().put(key, data, "image/webp");
  return { ...stored, width: info.width, height: info.height, sizeBytes: info.size, mime: "image/webp" };
}

/** Silme hatası ana işlemi bozmasın (ör. dosya zaten yok). */
export async function deleteStoredImage(file: StoredFile | null | undefined) {
  if (!file?.key) return;
  try {
    await getStorage().delete(file);
  } catch {
    /* yetim dosya kalabilir; kritik değil */
  }
}
