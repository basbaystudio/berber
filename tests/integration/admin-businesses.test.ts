import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { auditLogs, businessSettings, businessUsers, businesses, districts } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import {
  createBusiness,
  getPublishChecklist,
  listBusinesses,
  setBusinessStatus,
  setPublished,
  updateBusinessProfile,
  updateOwnerAccount,
} from "@/server/modules/admin/businesses";
import { acceptContract, pendingContractVersions } from "@/server/modules/business/contracts";
import { anyDistrict, makeAdmin, makeBusiness, uid } from "../helpers/factory";

async function err(p: Promise<unknown>) {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(AppError);
  return e as AppError;
}

describe("admin: işletme oluşturma", () => {
  it("işletme, ayarlar ve zorunlu şifre değişimli hesap oluşturur; denetim kaydı yazar", async () => {
    const admin = await makeAdmin();
    const r = await makeBusiness(admin.id, { name: "Çağlar Kuaför Şişli" });
    expect(r.slug).toMatch(/^caglar-kuafor-sisli/);
    const [b] = await db.select().from(businesses).where(eq(businesses.id, r.businessId));
    expect(b?.status).toBe("DRAFT");
    expect(b?.isPublished).toBe(false);
    expect(await db.select().from(businessSettings).where(eq(businessSettings.businessId, r.businessId))).toHaveLength(1);
    const [u] = await db.select().from(businessUsers).where(eq(businessUsers.businessId, r.businessId));
    expect(u?.mustChangePassword).toBe(true);
    expect(u?.passwordHash).not.toContain(r.tempPassword);
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.businessId, r.businessId), eq(auditLogs.action, "business.create")));
    expect(logs).toHaveLength(1);
  });

  it("aynı addan otomatik benzersiz slug üretir", async () => {
    const admin = await makeAdmin();
    const name = `Aynı İsim ${uid()}`;
    const a = await makeBusiness(admin.id, { name });
    const b = await makeBusiness(admin.id, { name });
    expect(b.slug).toBe(`${a.slug}-2`);
  });

  it("elle verilen slug ve kullanıcı adı çakışmasını alan hatasıyla bildirir", async () => {
    const admin = await makeAdmin();
    const a = await makeBusiness(admin.id);
    const e1 = await err(makeBusiness(admin.id, { slug: a.slug }));
    expect(e1.code).toBe("CONFLICT");
    expect(e1.fieldErrors?.slug).toBeDefined();
    const e2 = await err(makeBusiness(admin.id, { login: a.login.toUpperCase() }));
    expect(e2.fieldErrors?.login).toBeDefined();
  });

  it("ile ait olmayan ilçeyi reddeder", async () => {
    const admin = await makeAdmin();
    const [ankaraDistrict] = await db.select().from(districts).where(eq(districts.provinceId, 6)).limit(1);
    const e = await err(
      createBusiness(db, { adminId: admin.id }, {
        name: "Yanlış İlçe",
        phone: "+905321234567",
        email: "x@test.local",
        addressLine: "Adres satırı",
        provinceId: 34,
        districtId: ankaraDistrict!.id,
        ownerName: "Ad Soyad",
        login: `x-${uid()}`,
      }),
    );
    expect(e.fieldErrors?.districtId).toBeDefined();
  });
});

describe("admin: durum ve yayın", () => {
  it("eksik profil yayına alınamaz", async () => {
    const admin = await makeAdmin();
    const r = await makeBusiness(admin.id);
    await setBusinessStatus(db, { adminId: admin.id }, r.businessId, "ACTIVE");
    const checklist = await getPublishChecklist(db, r.businessId);
    expect(checklist.find((c) => c.key === "active")?.ok).toBe(true);
    expect(checklist.find((c) => c.key === "staff")?.ok).toBe(false);
    const e = await err(setPublished(db, { adminId: admin.id }, r.businessId, true));
    expect(e.message).toMatch(/eksikler/);
  });

  it("eksik belge yöneticiyi engellemez; diğer eksikler engeller", async () => {
    const admin = await makeAdmin();
    const r = await makeBusiness(admin.id);
    await setBusinessStatus(db, { adminId: admin.id }, r.businessId, "ACTIVE");
    // Randevu alabilecek kadar hazır profil, ama hiç belge yok
    await db.update(businesses).set({ latitude: 41, longitude: 29 }).where(eq(businesses.id, r.businessId));
    await db.execute(sql`insert into business_hours (business_id, weekday, start_time, end_time) values (${r.businessId}, 1, '09:00', '18:00')`);
    const st = (await db.execute<{ id: string }>(sql`insert into staff (business_id, name) values (${r.businessId}, 'Usta') returning id`)).rows[0]!;
    const sv = (await db.execute<{ id: string }>(sql`insert into services (business_id, name, price_kurus, duration_min) values (${r.businessId}, 'Kesim', 40000, 30) returning id`)).rows[0]!;
    await db.execute(sql`insert into staff_services (business_id, staff_id, service_id) values (${r.businessId}, ${st.id}, ${sv.id})`);

    // Başka testlerin yayınladığı sözleşmeler varsa işletme onaylasın
    for (const v of await pendingContractVersions(db, r.businessId)) await acceptContract(db, { businessId: r.businessId, userId: r.userId }, v.id, {});

    const checklist = await getPublishChecklist(db, r.businessId);
    expect(checklist.find((c) => c.key === "documents")).toMatchObject({ ok: false, required: false });
    expect(checklist.filter((c) => c.required).every((c) => c.ok)).toBe(true);
    await setPublished(db, { adminId: admin.id }, r.businessId, true);
    expect((await db.select().from(businesses).where(eq(businesses.id, r.businessId)))[0]?.isPublished).toBe(true);
  });

  it("veritabanı da yayındaki işletmenin aktif olmasını zorunlu tutar", async () => {
    const admin = await makeAdmin();
    const r = await makeBusiness(admin.id);
    await expect(db.update(businesses).set({ isPublished: true }).where(eq(businesses.id, r.businessId))).rejects.toThrow();
  });

  it("askıya alma yayından kaldırır", async () => {
    const admin = await makeAdmin();
    const r = await makeBusiness(admin.id);
    await setBusinessStatus(db, { adminId: admin.id }, r.businessId, "ACTIVE");
    await db.update(businesses).set({ isPublished: true }).where(eq(businesses.id, r.businessId)); // test için doğrudan
    await setBusinessStatus(db, { adminId: admin.id }, r.businessId, "SUSPENDED");
    const [b] = await db.select().from(businesses).where(eq(businesses.id, r.businessId));
    expect(b?.status).toBe("SUSPENDED");
    expect(b?.isPublished).toBe(false);
  });

  it("profil güncelleme ve hesap güncelleme çalışır", async () => {
    const admin = await makeAdmin();
    const r = await makeBusiness(admin.id);
    const d = await anyDistrict();
    const slug = `yeni-${uid()}`;
    await updateBusinessProfile(db, { adminId: admin.id }, r.businessId, {
      name: "Yeni Ad",
      slug,
      phone: "+902125556677",
      email: "yeni@test.local",
      addressLine: "Yeni adres satırı",
      provinceId: d.provinceId,
      districtId: d.id,
      latitude: 41.0,
      longitude: 29.0,
    });
    const [b] = await db.select().from(businesses).where(eq(businesses.id, r.businessId));
    expect(b).toMatchObject({ name: "Yeni Ad", slug, latitude: 41.0 });
    await updateOwnerAccount(db, { adminId: admin.id }, r.businessId, { ownerName: "Yeni Yetkili", login: `yeni-${uid()}`, isActive: false });
    const [u] = await db.select().from(businessUsers).where(eq(businessUsers.businessId, r.businessId));
    expect(u?.isActive).toBe(false);
  });

  it("liste araması ve durum filtresi", async () => {
    const admin = await makeAdmin();
    const tag = uid();
    const r = await makeBusiness(admin.id, { name: `Aranan ${tag}` });
    const res = await listBusinesses(db, { q: tag });
    expect(res.rows.map((x) => x.id)).toEqual([r.businessId]);
    const drafts = await listBusinesses(db, { q: tag, status: "ACTIVE" });
    expect(drafts.rows).toHaveLength(0);
    // LIKE özel karakterleri kaçışlanır
    expect((await listBusinesses(db, { q: "%" })).rows.every((x) => x.name.includes("%"))).toBe(true);
  });
});
