import "server-only";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { getSetting } from "@/server/modules/platform/settings";
import { publicCondition } from "@/server/modules/marketplace/search";

/**
 * Lansman modu açık mı: admin açtıysa ve yayındaki berber sayısı eşiğin altındaysa.
 * Açıkken müşteriler pazaryerini (liste, arama, şehir sayfaları) göremez; platformun boş görünmesi engellenir.
 */
export async function launchState() {
  const cfg = await getSetting(db, "marketplace.launchMode");
  const published = await db.$count(businesses, publicCondition);
  return { ...cfg, published, active: cfg.enabled && published < cfg.autoOpenAt };
}
export async function isLaunchMode() {
  return (await launchState()).active;
}
