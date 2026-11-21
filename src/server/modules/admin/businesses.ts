import "server-only";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { DB, Executor } from "@/server/db/client";
import { businessSettings, businessUsers, businesses, districts, provinces } from "@/server/db/schema";
import { AppError, notFound, pgConstraint, pgErrorCode, PG } from "@/server/lib/errors";
import { audit } from "@/server/lib/audit";
import { generateTempPassword, hashPassword } from "@/server/auth/password";
import { invalidateAllSessions } from "@/server/auth/session";
import { slugify } from "@/lib/slug";
import { getPublishChecklist } from "@/server/modules/business/publish";
import { assignInitialSubscription } from "@/server/modules/billing/subscriptions";
export { getPublishChecklist };
import type { BusinessProfileInput, CreateBusinessInput } from "@/lib/validation/business";

export type AdminActor = { adminId: string; ip?: string | null };

async function assertDistrictInProvince(db: Executor, provinceId: number, districtId: number) {
  const [d] = await db.select({ provinceId: districts.provinceId }).from(districts).where(eq(districts.id, districtId)).limit(1);
  if (!d || d.provinceId !== provinceId)
    throw new AppError("VALIDATION", "Lütfen formdaki hataları düzeltin.", { districtId: "Seçilen ilçe bu ile ait değil." });
}

function mapUniqueError(err: unknown): never {
  if (pgErrorCode(err) === PG.UNIQUE_VIOLATION) {
    const c = pgConstraint(err);
    if (c === "businesses_slug_uq")
      throw new AppError("CONFLICT", "Bu bağlantı adı başka bir işletme tarafından kullanılıyor.", { slug: "Bu bağlantı adı kullanılıyor." });
    if (c === "business_users_login_uq")
      throw new AppError("CONFLICT", "Bu kullanıcı adı başka bir hesapta kullanılıyor.", { login: "Bu kullanıcı adı kullanılıyor." });
  }
  throw err;
}

/** Slug verilmemişse addan üretir; çakışırsa sonuna sayı ekler. */
async function resolveSlug(db: Executor, name: string, requested?: string, excludeId?: string): Promise<string> {
  if (requested) return requested;
  const base = slugify(name) || "isletme";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const conds: SQL[] = [eq(businesses.slug, candidate)];
    if (excludeId) conds.push(sql`${businesses.id} <> ${excludeId}`);
    const [hit] = await db.select({ id: businesses.id }).from(businesses).where(and(...conds)).limit(1);
    if (!hit) return candidate;
  }
  throw new AppError("CONFLICT", "Uygun bir bağlantı adı üretilemedi, lütfen elle girin.", { slug: "Bağlantı adını elle girin." });
}

/** Yeni işletme + ayarlar + işletme hesabı. Geçici şifre yalnızca bir kez döner. */
export async function createBusiness(db: DB, actor: AdminActor, input: CreateBusinessInput) {
  await assertDistrictInProvince(db, input.provinceId, input.districtId);
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  try {
    return await db.transaction(async (tx) => {
      const slug = await resolveSlug(tx, input.name, input.slug);
      const [b] = await tx
        .insert(businesses)
        .values({
          slug,
          name: input.name,
          phone: input.phone,
          description: input.description ?? null,
          addressLine: input.addressLine,
          provinceId: input.provinceId,
          districtId: input.districtId,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
        })
        .returning({ id: businesses.id, slug: businesses.slug });
      await tx.insert(businessSettings).values({ businessId: b!.id });
      const sub = await assignInitialSubscription(tx, b!.id);
      const [u] = await tx
        .insert(businessUsers)
        .values({ businessId: b!.id, login: input.login, name: input.ownerName, passwordHash, mustChangePassword: true })
        .returning({ id: businessUsers.id });
      await audit(tx, {
        actorRealm: "ADMIN",
        actorId: actor.adminId,
        businessId: b!.id,
        action: "business.create",
        entity: "business",
        entityId: b!.id,
        meta: { name: input.name, slug, login: input.login, trialMonths: sub.trialMonths, earlyAdopter: sub.isEarlyAdopter },
        ip: actor.ip,
      });
      return { businessId: b!.id, slug: b!.slug, userId: u!.id, login: input.login, tempPassword };
    });
  } catch (err) {
    mapUniqueError(err);
  }
}

export async function updateBusinessProfile(db: DB, actor: AdminActor, businessId: string, input: BusinessProfileInput) {
  await assertDistrictInProvince(db, input.provinceId, input.districtId);
  try {
    await db.transaction(async (tx) => {
      const [cur] = await tx.select({ slug: businesses.slug }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!cur) throw notFound("İşletme");
      const slug = input.slug ?? cur.slug;
      await tx
        .update(businesses)
        .set({
          name: input.name,
          slug,
          phone: input.phone,
          description: input.description ?? null,
          addressLine: input.addressLine,
          provinceId: input.provinceId,
          districtId: input.districtId,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, businessId));
      await audit(tx, {
        actorRealm: "ADMIN",
        actorId: actor.adminId,
        businessId,
        action: "business.update",
        entity: "business",
        entityId: businessId,
        meta: { slugChanged: slug !== cur.slug },
        ip: actor.ip,
      });
    });
  } catch (err) {
    mapUniqueError(err);
  }
}

/** Aktif / askıya alınmış. Askıya alınca yayından kalkar ve işletme oturumları kapanır. */
export async function setBusinessStatus(db: DB, actor: AdminActor, businessId: string, status: "ACTIVE" | "SUSPENDED") {
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update").limit(1);
    if (!b) throw notFound("İşletme");
    if (b.status === status) return;
    await tx
      .update(businesses)
      .set({
        status,
        ...(status === "SUSPENDED" ? { isPublished: false } : {}),
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));
    if (status === "SUSPENDED") {
      const users = await tx.select({ id: businessUsers.id }).from(businessUsers).where(eq(businessUsers.businessId, businessId));
      for (const u of users) await invalidateAllSessions(tx, "BUSINESS", u.id);
    }
    await audit(tx, {
      actorRealm: "ADMIN",
      actorId: actor.adminId,
      businessId,
      action: status === "ACTIVE" ? "business.activate" : "business.suspend",
      entity: "business",
      entityId: businessId,
      ip: actor.ip,
    });
  });
}

export async function setPublished(db: DB, actor: AdminActor, businessId: string, publish: boolean) {
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update").limit(1);
    if (!b) throw notFound("İşletme");
    if (publish) {
      const missing = (await getPublishChecklist(tx, businessId)).filter((c) => !c.ok);
      if (missing.length)
        throw new AppError("VALIDATION", `Yayına almak için eksikler var: ${missing.map((m) => m.label.toLocaleLowerCase("tr-TR")).join(", ")}.`);
    }
    await tx
      .update(businesses)
      .set({ isPublished: publish, publishedAt: publish ? (b.publishedAt ?? new Date()) : b.publishedAt, updatedAt: new Date() })
      .where(eq(businesses.id, businessId));
    await audit(tx, {
      actorRealm: "ADMIN",
      actorId: actor.adminId,
      businessId,
      action: publish ? "business.publish" : "business.unpublish",
      entity: "business",
      entityId: businessId,
      ip: actor.ip,
    });
  });
}

export async function setFeatured(db: DB, actor: AdminActor, businessId: string, featured: boolean) {
  const res = await db
    .update(businesses)
    .set({ isFeatured: featured, featuredRank: featured ? sql`coalesce(${businesses.featuredRank}, 100)` : null, updatedAt: new Date() })
    .where(eq(businesses.id, businessId))
    .returning({ id: businesses.id });
  if (!res.length) throw notFound("İşletme");
  await audit(db, {
    actorRealm: "ADMIN",
    actorId: actor.adminId,
    businessId,
    action: featured ? "business.feature" : "business.unfeature",
    entity: "business",
    entityId: businessId,
    ip: actor.ip,
  });
}

/** Yeni geçici şifre üretir, ilk girişte değiştirme zorunlu olur, açık oturumlar kapanır. */
export async function resetOwnerPassword(db: DB, actor: AdminActor, businessId: string) {
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(businessUsers).where(eq(businessUsers.businessId, businessId)).limit(1);
    if (!u) throw notFound("İşletme hesabı");
    await tx.update(businessUsers).set({ passwordHash, mustChangePassword: true }).where(eq(businessUsers.id, u.id));
    await invalidateAllSessions(tx, "BUSINESS", u.id);
    await audit(tx, {
      actorRealm: "ADMIN",
      actorId: actor.adminId,
      businessId,
      action: "business_user.reset_password",
      entity: "business_user",
      entityId: u.id,
      ip: actor.ip,
    });
    return { login: u.login, tempPassword };
  });
}

export async function updateOwnerAccount(
  db: DB,
  actor: AdminActor,
  businessId: string,
  input: { ownerName: string; login: string; isActive: boolean },
) {
  try {
    await db.transaction(async (tx) => {
      const [u] = await tx.select().from(businessUsers).where(eq(businessUsers.businessId, businessId)).limit(1);
      if (!u) throw notFound("İşletme hesabı");
      await tx.update(businessUsers).set({ name: input.ownerName, login: input.login, isActive: input.isActive }).where(eq(businessUsers.id, u.id));
      if (!input.isActive || input.login !== u.login) await invalidateAllSessions(tx, "BUSINESS", u.id);
      await audit(tx, {
        actorRealm: "ADMIN",
        actorId: actor.adminId,
        businessId,
        action: "business_user.update",
        entity: "business_user",
        entityId: u.id,
        meta: { loginChanged: input.login !== u.login, isActive: input.isActive },
        ip: actor.ip,
      });
    });
  } catch (err) {
    mapUniqueError(err);
  }
}

export type BusinessListFilter = { q?: string; status?: "DRAFT" | "ACTIVE" | "SUSPENDED"; page?: number };
export const PAGE_SIZE = 20;

export async function listBusinesses(db: Executor, f: BusinessListFilter) {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(businesses.status, f.status));
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(or(ilike(businesses.name, like), ilike(businesses.slug, like), ilike(businessUsers.login, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, f.page ?? 1);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        status: businesses.status,
        isPublished: businesses.isPublished,
        isFeatured: businesses.isFeatured,
        createdAt: businesses.createdAt,
        province: provinces.name,
        district: districts.name,
        login: businessUsers.login,
        lastLoginAt: businessUsers.lastLoginAt,
      })
      .from(businesses)
      .innerJoin(provinces, eq(provinces.id, businesses.provinceId))
      .innerJoin(districts, eq(districts.id, businesses.districtId))
      .leftJoin(businessUsers, eq(businessUsers.businessId, businesses.id))
      .where(where)
      .orderBy(desc(businesses.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(businesses)
      .leftJoin(businessUsers, eq(businessUsers.businessId, businesses.id))
      .where(where),
  ]);
  return { rows, total: total?.n ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getBusinessDetail(db: Executor, businessId: string) {
  const [row] = await db
    .select({ b: businesses, province: provinces.name, district: districts.name })
    .from(businesses)
    .innerJoin(provinces, eq(provinces.id, businesses.provinceId))
    .innerJoin(districts, eq(districts.id, businesses.districtId))
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!row) return null;
  const [owner] = await db
    .select({
      id: businessUsers.id,
      name: businessUsers.name,
      login: businessUsers.login,
      isActive: businessUsers.isActive,
      mustChangePassword: businessUsers.mustChangePassword,
      lastLoginAt: businessUsers.lastLoginAt,
      createdAt: businessUsers.createdAt,
    })
    .from(businessUsers)
    .where(eq(businessUsers.businessId, businessId))
    .limit(1);
  return { ...row.b, provinceName: row.province, districtName: row.district, owner: owner ?? null };
}
