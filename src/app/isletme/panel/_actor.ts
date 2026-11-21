import "server-only";
import { db } from "@/server/db/client";
import { requireBusiness } from "@/server/auth/guards";
import { enforce, RATE_LIMITS } from "@/server/auth/rate-limit";
import { getRequestMeta } from "@/server/lib/request";
import type { Biz } from "@/server/modules/business/context";

/** İşletme paneli server action'larının başında çağrılır. businessId yalnızca oturumdan gelir. */
export async function bizActor(opts: { upload?: boolean } = {}): Promise<Biz> {
  const ctx = await requireBusiness();
  if (opts.upload) await enforce(db, `upload:biz:${ctx.businessId}`, RATE_LIMITS.upload);
  return { businessId: ctx.businessId, userId: ctx.user.id, ip: (await getRequestMeta()).ip };
}
