import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { setSetting } from "@/server/modules/platform/settings";
import { launchState } from "@/server/modules/marketplace/launch";

describe("lansman modu", () => {
  it("açıkken ve berber sayısı eşiğin altındayken aktif; eşik aşılınca ya da kapatılınca pazaryeri açılır", async () => {
    await setSetting(db, "marketplace.launchMode", { enabled: true, autoOpenAt: 1_000_000 });
    expect((await launchState()).active).toBe(true);
    await setSetting(db, "marketplace.launchMode", { enabled: true, autoOpenAt: 0 });
    expect((await launchState()).active).toBe(false);
    await setSetting(db, "marketplace.launchMode", { enabled: false, autoOpenAt: 1_000_000 });
    expect((await launchState()).active).toBe(false);
  });
});
