import { z } from "zod";
import { db } from "@/server/db/client";
import { getBusiness } from "@/server/auth/guards";
import { AppError } from "@/server/lib/errors";
import { fileResponse } from "@/server/lib/file-response";
import { getInvoiceFile } from "@/server/modules/billing/invoices";

/** İşletme yalnızca KENDİ ödemesinin faturasını indirebilir (başka işletmenin faturası için 404). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBusiness();
  if (!ctx) return new Response("Yetkisiz", { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new Response("Bulunamadı", { status: 404 });
  try {
    const f = await getInvoiceFile(db, id, { businessId: ctx.businessId });
    return fileResponse(f.buffer, f.fileName, "application/pdf");
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") return new Response("Bulunamadı", { status: 404 });
    throw e;
  }
}
