import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { appointments, businessTrustScores, businesses, staff, businessCustomers, customers } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { recomputeTrust } from "@/server/modules/trust/score";
import { makeAdmin, makeBusiness } from "../helpers/factory";

describe("güven puanı (veritabanı)", () => {
  it("süresi içinde onaylanmayan talepler puanı düşürür ve kayıt edilir", async () => {
    const admin = await makeAdmin();
    const b = await makeBusiness(admin.id);
    await db.update(businesses).set({ lastPanelActivityAt: new Date() }).where(eq(businesses.id, b.businessId));
    const [s] = await db.insert(staff).values({ businessId: b.businessId, name: "U" }).returning();
    const [acct] = await db
      .insert(customers)
      .values({ name: "M", email: `trust-${Date.now()}@test.local`, phone: "+905550000000", passwordHash: await hashPassword("Musteri2026x"), kvkkConsentAt: new Date() })
      .returning();
    const [c] = await db.insert(businessCustomers).values({ businessId: b.businessId, displayName: "M", customerId: acct!.id }).returning();
    const fresh = await recomputeTrust(db, b.businessId);
    // 10 talep: 8 süre doldu, 2 hızlı onay
    const base = Date.now() + 86_400_000;
    for (let i = 0; i < 10; i++) {
      const st = new Date(base + i * 3_600_000);
      const expired = i < 8;
      await db.insert(appointments).values({
        businessId: b.businessId,
        staffId: s!.id,
        businessCustomerId: c!.id,
        startsAt: st,
        endsAt: new Date(st.getTime() + 1_800_000),
        blockedUntil: new Date(st.getTime() + 1_800_000),
        status: expired ? "CANCELLED" : "CONFIRMED",
        source: "ONLINE",
        customerId: acct!.id,
        totalKurus: 100,
        cancelledAt: expired ? new Date() : null,
        cancelReason: expired ? "NOT_CONFIRMED_IN_TIME" : null,
        confirmedAt: expired ? null : new Date(),
      });
    }
    const after = await recomputeTrust(db, b.businessId, { history: true });
    const [row] = await db.select().from(businessTrustScores).where(eq(businessTrustScores.businessId, b.businessId));
    expect(Number(row!.score)).toBe(after.score);
    expect(after.raw).toMatchObject({ expired: 8, decided: 2, confirmed: 2 });
    expect(after.score).toBeLessThan(40); // vitrin eşiğinin altına düşer
    expect(fresh.score).toBeGreaterThan(70);
  });
});
