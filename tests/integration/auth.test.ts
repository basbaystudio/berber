import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { businessUsers, businesses, sessions } from "@/server/db/schema";
import { login } from "@/server/auth/login";
import { createSession, invalidateAllSessions, validateSession } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { hashToken } from "@/server/auth/tokens";
import { AppError } from "@/server/lib/errors";
import { resetOwnerPassword, setBusinessStatus } from "@/server/modules/admin/businesses";
import { changeBusinessPassword } from "@/server/modules/business/account";
import { clearRateLimits, makeAdmin, makeBusiness } from "../helpers/factory";

const meta = { ip: "10.0.0.1", userAgent: "vitest" };

async function expectAppError(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

beforeEach(clearRateLimits);

describe("şifre hash", () => {
  it("argon2id kullanır ve doğrular", async () => {
    const h = await hashPassword("Deneme12345");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "Deneme12345")).toBe(true);
    expect(await verifyPassword(h, "deneme12345")).toBe(false);
    expect(await verifyPassword("bozuk-hash", "x")).toBe(false);
  });
});

describe("giriş", () => {
  it("admin doğru bilgilerle giriş yapar; token DB'de yalnızca hash olarak saklanır", async () => {
    const admin = await makeAdmin();
    const r = await login(db, "ADMIN", admin.email.toUpperCase(), admin.password, meta);
    expect(r.principalId).toBe(admin.id);
    const [s] = await db.select().from(sessions).where(eq(sessions.id, hashToken(r.token)));
    expect(s?.realm).toBe("ADMIN");
    expect(await db.select().from(sessions).where(eq(sessions.id, r.token))).toHaveLength(0);
  });

  it("yanlış şifre ve olmayan hesap aynı mesajı verir", async () => {
    const admin = await makeAdmin();
    const a = await expectAppError(login(db, "ADMIN", admin.email, "YanlisSifre1", meta), "INVALID_CREDENTIALS");
    const b = await expectAppError(login(db, "ADMIN", "yok@test.local", "YanlisSifre1", meta), "INVALID_CREDENTIALS");
    expect(a.message).toBe(b.message);
  });

  it("hesap bazında 5 denemeden sonra kilitlenir", async () => {
    const admin = await makeAdmin();
    for (let i = 0; i < 5; i++) await expectAppError(login(db, "ADMIN", admin.email, "YanlisSifre1", meta), "INVALID_CREDENTIALS");
    // Doğru şifre bile artık reddedilir
    await expectAppError(login(db, "ADMIN", admin.email, admin.password, meta), "RATE_LIMITED");
  });

  it("başarılı giriş hesap sayacını sıfırlar", async () => {
    const admin = await makeAdmin();
    for (let i = 0; i < 3; i++) await expectAppError(login(db, "ADMIN", admin.email, "YanlisSifre1", meta), "INVALID_CREDENTIALS");
    await login(db, "ADMIN", admin.email, admin.password, meta);
    for (let i = 0; i < 4; i++) await expectAppError(login(db, "ADMIN", admin.email, "YanlisSifre1", meta), "INVALID_CREDENTIALS");
  });
});

describe("realm izolasyonu", () => {
  it("bir realm'in token'ı diğer realm'lerde geçersizdir", async () => {
    const admin = await makeAdmin();
    const { token } = await login(db, "ADMIN", admin.email, admin.password, meta);
    expect(await validateSession(db, "ADMIN", token)).not.toBeNull();
    expect(await validateSession(db, "BUSINESS", token)).toBeNull();
    expect(await validateSession(db, "CUSTOMER", token)).toBeNull();
  });

  it("işletme hesabı admin girişinde kullanılamaz", async () => {
    const admin = await makeAdmin();
    const biz = await makeBusiness(admin.id);
    await expectAppError(login(db, "ADMIN", biz.login, biz.tempPassword, meta), "INVALID_CREDENTIALS");
    const r = await login(db, "BUSINESS", biz.login, biz.tempPassword, meta);
    expect(await validateSession(db, "BUSINESS", r.token)).not.toBeNull();
  });

  it("geçersiz / bozuk token'lar reddedilir", async () => {
    expect(await validateSession(db, "ADMIN", undefined)).toBeNull();
    expect(await validateSession(db, "ADMIN", "kisa")).toBeNull();
    expect(await validateSession(db, "ADMIN", "x".repeat(43))).toBeNull();
  });

  it("süresi dolmuş oturum reddedilir ve silinir", async () => {
    const admin = await makeAdmin();
    const { token, session } = await createSession(db, "ADMIN", admin.id);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, session.id));
    expect(await validateSession(db, "ADMIN", token)).toBeNull();
    expect(await db.select().from(sessions).where(eq(sessions.id, session.id))).toHaveLength(0);
  });
});

describe("işletme hesabı yaşam döngüsü", () => {
  it("askıya alınan işletme giriş yapamaz ve açık oturumları kapanır", async () => {
    const admin = await makeAdmin();
    const biz = await makeBusiness(admin.id);
    await setBusinessStatus(db, { adminId: admin.id }, biz.businessId, "ACTIVE");
    const { token } = await login(db, "BUSINESS", biz.login, biz.tempPassword, meta);
    await setBusinessStatus(db, { adminId: admin.id }, biz.businessId, "SUSPENDED");
    expect(await validateSession(db, "BUSINESS", token)).toBeNull();
    const e = await expectAppError(login(db, "BUSINESS", biz.login, biz.tempPassword, meta), "ACCOUNT_DISABLED");
    expect(e.message).toMatch(/askıya/);
    // Yanlış şifreyle hesap durumu sızdırılmaz
    await expectAppError(login(db, "BUSINESS", biz.login, "YanlisSifre99", meta), "INVALID_CREDENTIALS");
  });

  it("pasif hesap giriş yapamaz", async () => {
    const admin = await makeAdmin();
    const biz = await makeBusiness(admin.id);
    await db.update(businessUsers).set({ isActive: false }).where(eq(businessUsers.id, biz.userId));
    await expectAppError(login(db, "BUSINESS", biz.login, biz.tempPassword, meta), "ACCOUNT_DISABLED");
  });

  it("şifre sıfırlama eski şifreyi ve oturumları geçersiz kılar", async () => {
    const admin = await makeAdmin();
    const biz = await makeBusiness(admin.id);
    const { token } = await login(db, "BUSINESS", biz.login, biz.tempPassword, meta);
    const reset = await resetOwnerPassword(db, { adminId: admin.id }, biz.businessId);
    expect(reset.tempPassword).not.toBe(biz.tempPassword);
    expect(await validateSession(db, "BUSINESS", token)).toBeNull();
    await expectAppError(login(db, "BUSINESS", biz.login, biz.tempPassword, meta), "INVALID_CREDENTIALS");
    await login(db, "BUSINESS", biz.login, reset.tempPassword, meta);
    const [u] = await db.select().from(businessUsers).where(eq(businessUsers.id, biz.userId));
    expect(u?.mustChangePassword).toBe(true);
  });

  it("şifre değişimi mevcut oturumu korur, diğerlerini kapatır, zorunlu değişim bayrağını kaldırır", async () => {
    const admin = await makeAdmin();
    const biz = await makeBusiness(admin.id);
    const s1 = await login(db, "BUSINESS", biz.login, biz.tempPassword, meta);
    const s2 = await login(db, "BUSINESS", biz.login, biz.tempPassword, meta);
    const current = (await validateSession(db, "BUSINESS", s1.token))!;
    await expectAppError(
      changeBusinessPassword(db, { userId: biz.userId, businessId: biz.businessId, sessionId: current.id }, "yanlis", "YeniSifre2026"),
      "VALIDATION",
    );
    await changeBusinessPassword(db, { userId: biz.userId, businessId: biz.businessId, sessionId: current.id }, biz.tempPassword, "YeniSifre2026");
    expect(await validateSession(db, "BUSINESS", s1.token)).not.toBeNull();
    expect(await validateSession(db, "BUSINESS", s2.token)).toBeNull();
    const [u] = await db.select().from(businessUsers).where(eq(businessUsers.id, biz.userId));
    expect(u?.mustChangePassword).toBe(false);
  });

  it("başka işletmenin kullanıcısı adına şifre değiştirilemez", async () => {
    const admin = await makeAdmin();
    const a = await makeBusiness(admin.id);
    const b = await makeBusiness(admin.id);
    await expectAppError(
      changeBusinessPassword(db, { userId: b.userId, businessId: a.businessId, sessionId: "x" }, b.tempPassword, "YeniSifre2026"),
      "NOT_FOUND",
    );
  });

  it("invalidateAllSessions yalnızca ilgili realm ve kişiyi etkiler", async () => {
    const admin = await makeAdmin();
    const s = await createSession(db, "ADMIN", admin.id);
    const other = await createSession(db, "BUSINESS", admin.id); // aynı uuid farklı realm
    await invalidateAllSessions(db, "BUSINESS", admin.id);
    expect(await validateSession(db, "ADMIN", s.token)).not.toBeNull();
    expect(await validateSession(db, "BUSINESS", other.token)).toBeNull();
  });
});

describe("işletme girişi e-postayla", () => {
  it("işletmenin e-postası (büyük/küçük harf fark etmez) ve şifresiyle giriş yapılır; yanlış şifre ve ortak e-posta reddedilir", async () => {
    const admin = await makeAdmin();
    const biz = await makeBusiness(admin.id);
    const [b] = await db.select({ email: businesses.email }).from(businesses).where(eq(businesses.id, biz.businessId));
    const r = await login(db, "BUSINESS", b!.email!.toUpperCase(), biz.tempPassword, meta);
    expect((await validateSession(db, "BUSINESS", r.token))?.principalId).toBe(biz.userId);
    await expect(login(db, "BUSINESS", b!.email!, "yanlis-sifre-123", meta)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    // İki işletme aynı e-postayı kullanıyorsa e-postayla giriş belirsizdir: kullanıcı adı gerekir
    const other = await makeBusiness(admin.id);
    await db.update(businesses).set({ email: b!.email }).where(eq(businesses.id, other.businessId));
    await clearRateLimits();
    await expect(login(db, "BUSINESS", b!.email!, biz.tempPassword, meta)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect((await login(db, "BUSINESS", biz.login, biz.tempPassword, meta)).principalId).toBe(biz.userId);
  });
});
