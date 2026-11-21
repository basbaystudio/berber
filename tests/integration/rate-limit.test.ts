import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { enforce, hit, resetLimit } from "@/server/auth/rate-limit";
import { AppError } from "@/server/lib/errors";
import { uid } from "../helpers/factory";

describe("rate limit", () => {
  it("pencere içinde limiti uygular", async () => {
    const key = `t:${uid()}`;
    const rule = { limit: 3, windowSec: 60 };
    expect((await hit(db, key, rule)).allowed).toBe(true);
    expect((await hit(db, key, rule)).allowed).toBe(true);
    expect((await hit(db, key, rule)).remaining).toBe(0);
    const r = await hit(db, key, rule);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
    await expect(enforce(db, key, rule)).rejects.toBeInstanceOf(AppError);
  });

  it("pencere dolunca sayaç sıfırlanır", async () => {
    const key = `t:${uid()}`;
    const rule = { limit: 1, windowSec: 60 };
    await hit(db, key, rule);
    expect((await hit(db, key, rule)).allowed).toBe(false);
    await db.execute(sql`UPDATE rate_limits SET window_ends_at = now() - interval '1 second' WHERE key = ${key}`);
    expect((await hit(db, key, rule)).allowed).toBe(true);
  });

  it("eşzamanlı isteklerde sayaç kaybolmaz", async () => {
    const key = `t:${uid()}`;
    const rule = { limit: 10, windowSec: 60 };
    const results = await Promise.all(Array.from({ length: 25 }, () => hit(db, key, rule)));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    await resetLimit(db, key);
    expect((await hit(db, key, rule)).allowed).toBe(true);
  });
});
