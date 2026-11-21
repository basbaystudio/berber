import "server-only";
import { eq } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { platformSettings } from "@/server/db/schema";
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettingKey } from "./defaults";

type Value<K extends PlatformSettingKey> = (typeof DEFAULT_PLATFORM_SETTINGS)[K] extends infer V
  ? V extends object
    ? { -readonly [P in keyof V]: V[P] extends number ? number : V[P] extends boolean ? boolean : V[P] }
    : V extends number
      ? number
      : V
  : never;

/** Veritabanındaki ayarı okur; yoksa varsayılanı döner. */
export async function getSetting<K extends PlatformSettingKey>(db: Executor, key: K): Promise<Value<K>> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  return (row?.value ?? DEFAULT_PLATFORM_SETTINGS[key]) as Value<K>;
}

export async function setSetting<K extends PlatformSettingKey>(db: Executor, key: K, value: Value<K>, adminId?: string) {
  await db
    .insert(platformSettings)
    .values({ key, value, updatedByAdminId: adminId ?? null })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedByAdminId: adminId ?? null, updatedAt: new Date() } });
}
