import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { hit } from "@/server/auth/rate-limit";
import { getRequestMeta } from "@/server/lib/request";
import { recordBannerClick } from "@/server/modules/admin/banners";

export const dynamic = "force-dynamic";

/** Reklam/banner tıklaması: sayacı artırır ve banner'ın bağlantısına yönlendirir. Aynı IP'den tekrar tıklamalar sayılmaz. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const home = new URL("/", req.url);
  if (!z.string().uuid().safeParse(id).success) return NextResponse.redirect(home);
  const { ip } = await getRequestMeta();
  const first = (await hit(db, `banner-click:${id}:${ip}`, { limit: 1, windowSec: 6 * 60 * 60 })).allowed;
  const link = await recordBannerClick(db, id, first);
  if (!link) return NextResponse.redirect(home);
  // Bağlantı kayıt sırasında doğrulanır: / ile başlayan iç adres ya da https:// adresi
  const target = link.startsWith("/") ? new URL(link, req.url) : new URL(link);
  const res = NextResponse.redirect(target, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
