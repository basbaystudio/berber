import { z } from "zod";
import { db } from "@/server/db/client";
import { getBusiness } from "@/server/auth/guards";
import { AppError } from "@/server/lib/errors";
import { fileResponse } from "@/server/lib/file-response";
import { getDocumentFile } from "@/server/modules/business/documents";

/** İşletme yalnızca KENDİ belgesini görebilir. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBusiness();
  if (!ctx) return new Response("Yetkisiz", { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new Response("Bulunamadı", { status: 404 });
  try {
    const f = await getDocumentFile(db, id, { businessId: ctx.businessId });
    return fileResponse(f.buffer, f.fileName, f.mime);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") return new Response("Bulunamadı", { status: 404 });
    throw e;
  }
}
