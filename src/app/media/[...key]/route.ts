import fs from "node:fs/promises";
import path from "node:path";
import { LOCAL_ROOT, isLocalStorage } from "@/server/storage";

/** Yalnızca yerel geliştirmede: .uploads klasöründeki görselleri sunar. Canlıda Vercel Blob URL'leri kullanılır. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!isLocalStorage()) return new Response("Bulunamadı", { status: 404 });
  const { key } = await params;
  const target = path.resolve(LOCAL_ROOT, ...key);
  if (!target.startsWith(LOCAL_ROOT + path.sep) || !target.endsWith(".webp")) return new Response("Bulunamadı", { status: 404 });
  try {
    const data = await fs.readFile(target);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }
}
