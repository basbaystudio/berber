import "server-only";

/** Yetkili dosya indirme yanıtı (önbelleğe alınmaz, tarayıcıda içerik tahmini kapalı). */
export function fileResponse(buffer: Buffer, fileName: string, mime: string, inline = true) {
  const ascii = fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
