import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { runBillingEnforcement } from "@/server/modules/billing/enforcement";
import { purgeExpiredSessions } from "@/server/auth/session";
import { purgeExpiredLimits } from "@/server/auth/rate-limit";
import { expireOverduePendings, sendTomorrowReminders } from "@/server/modules/booking/service";
import { recomputeAllTrust } from "@/server/modules/trust/score";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Günlük bakım işi (Vercel Cron): abonelik kontrolü, süresi dolan talepler, yarınki randevu hatırlatmaları, güven puanları, temizlik. */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  try {
    const billing = await runBillingEnforcement(db);
    const expired = await expireOverduePendings(db);
    const reminders = await sendTomorrowReminders(db);
    const trust = await recomputeAllTrust(db);
    await purgeExpiredSessions(db);
    await purgeExpiredLimits(db);
    const summary = { billing, expired, reminders, trustUpdated: trust };
    logger.info("cron_daily", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    logger.error("cron_daily_failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
