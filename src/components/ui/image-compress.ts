"use client";

/**
 * Yüklemeden önce görseli tarayıcıda küçültür (uzun kenar en fazla `maxSide`, JPEG).
 * Telefon fotoğrafları 5-12 MB olabilir; sunucuya gitmeden önce ~1 MB'a düşer. Asıl doğrulama sunucudadır.
 */
export async function compressImage(file: File, maxSide = 2400, quality = 0.88): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // tarayıcı çözemiyorsa olduğu gibi gönder; sunucu karar verir
  }
}
