import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { runBillingEnforcement } from "@/server/modules/billing/enforcement";
import { purgeExpiredSessions } from "@/server/auth/session";
import { purgeExpiredLimits } from "@/server/auth/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Günlük bakım işi (Vercel Cron): abonelik kontrolü + süresi dolan oturum ve sayaçların temizliği. */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  try {
    const billing = await runBillingEnforcement(db);
    await purgeExpiredSessions(db);
    await purgeExpiredLimits(db);
    logger.info("cron_daily", billing);
    return NextResponse.json({ ok: true, billing });
  } catch (err) {
    logger.error("cron_daily_failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
