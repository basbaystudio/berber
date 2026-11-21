/**
 * Referans verileri: il/ilçe, hizmet türleri, varsayılan platform ayarları.
 * Tekrar çalıştırılabilir (idempotent).
 */
import fs from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { loadEnv } from "./env";
import * as schema from "../src/server/db/schema";
import { slugify } from "../src/lib/slug";
import { DEFAULT_PLATFORM_SETTINGS } from "../src/server/modules/platform/defaults";

loadEnv();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

type Province = { code: number; name: string; districts: string[] };
const provinces: Province[] = JSON.parse(fs.readFileSync("scripts/data/il-ilce.json", "utf8"));

const SERVICE_TYPES = [
  "Saç Kesimi",
  "Sakal Tıraşı",
  "Saç ve Sakal",
  "Çocuk Saç Kesimi",
  "Saç Yıkama",
  "Fön ve Şekillendirme",
  "Saç Boyama",
  "Perma",
  "Keratin Bakımı",
  "Cilt Bakımı",
  "Ağda",
  "Kaş Düzeltme",
  "Damat Tıraşı",
  "Masaj",
];

await db.transaction(async (tx) => {
  await tx
    .insert(schema.provinces)
    .values(provinces.map((p) => ({ id: p.code, name: p.name, slug: slugify(p.name) })))
    .onConflictDoUpdate({ target: schema.provinces.id, set: { name: sql`excluded.name`, slug: sql`excluded.slug` } });

  const districtRows = provinces.flatMap((p) => p.districts.map((d) => ({ provinceId: p.code, name: d, slug: slugify(d) })));
  for (let i = 0; i < districtRows.length; i += 500) {
    await tx
      .insert(schema.districts)
      .values(districtRows.slice(i, i + 500))
      .onConflictDoUpdate({ target: [schema.districts.provinceId, schema.districts.slug], set: { name: sql`excluded.name` } });
  }

  await tx
    .insert(schema.serviceTypes)
    .values(SERVICE_TYPES.map((name, i) => ({ name, slug: slugify(name), sortOrder: i })))
    .onConflictDoNothing();

  for (const [key, value] of Object.entries(DEFAULT_PLATFORM_SETTINGS)) {
    await tx.insert(schema.platformSettings).values({ key, value }).onConflictDoNothing();
  }

  // Sabit tarihli resmî tatiller (dini bayramlar her yıl değiştiği için admin panelinden eklenir)
  const FIXED = [
    ["01-01", "Yılbaşı", false],
    ["04-23", "Ulusal Egemenlik ve Çocuk Bayramı", false],
    ["05-01", "Emek ve Dayanışma Günü", false],
    ["05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı", false],
    ["07-15", "Demokrasi ve Millî Birlik Günü", false],
    ["08-30", "Zafer Bayramı", false],
    ["10-28", "Cumhuriyet Bayramı Arifesi", true],
    ["10-29", "Cumhuriyet Bayramı", false],
  ] as const;
  const year = new Date().getFullYear();
  for (const y of [year, year + 1, year + 2]) {
    await tx
      .insert(schema.publicHolidays)
      .values(FIXED.map(([md, name, half]) => ({ date: `${y}-${md}`, name, isHalfDay: half })))
      .onConflictDoNothing();
  }

  // İşletmelerden istenen yasal belgeler (admin panelinden değiştirilebilir)
  await tx
    .insert(schema.documentTypes)
    .values([
      { name: "Vergi levhası", description: "Güncel yıla ait vergi levhası", isRequired: true, sortOrder: 0 },
      { name: "İşyeri açma ve çalışma ruhsatı", description: "Belediyeden alınan ruhsat", isRequired: true, sortOrder: 1 },
    ])
    .onConflictDoNothing();

  // Varsayılan abonelik paketi (yalnızca hiç paket yoksa)
  const plans = await tx.select({ id: schema.subscriptionPlans.id }).from(schema.subscriptionPlans).limit(1);
  if (!plans.length) {
    await tx.insert(schema.subscriptionPlans).values({
      code: "standart",
      name: "Standart",
      description: "Online randevu, işletme paneli ve pazaryeri profili.",
      monthlyPriceKurus: 69990,
      yearlyPriceKurus: 699000,
      highlights: ["Pazaryerinde işletme profili", "Online randevu ve takvim", "Çalışan ve hizmet yönetimi", "30 fotoğraflık portfolyo"],
      isDefault: true,
    });
  }

  // Aboneliği olmayan eski işletmelere oluşturulma sırasıyla abonelik ata (kampanya kuralı korunur)
  await tx.execute(sql`
    WITH cfg AS (
      SELECT coalesce((SELECT (value->>'limit')::int FROM platform_settings WHERE key = 'billing.earlyAdopter'), 20) AS lim,
             coalesce((SELECT (value->>'trialMonths')::int FROM platform_settings WHERE key = 'billing.earlyAdopter'), 3) AS early_m,
             coalesce((SELECT value::text::int FROM platform_settings WHERE key = 'billing.defaultTrialMonths'), 1) AS def_m,
             (SELECT count(*) FROM business_subscriptions WHERE is_early_adopter) AS used
    ), todo AS (
      SELECT b.id, row_number() OVER (ORDER BY b.created_at) AS rn
        FROM businesses b LEFT JOIN business_subscriptions s ON s.business_id = b.id
       WHERE s.id IS NULL
    )
    INSERT INTO business_subscriptions (business_id, plan_id, monthly_fee_kurus, trial_months, is_early_adopter)
    SELECT t.id, p.id, p.monthly_price_kurus,
           CASE WHEN cfg.used + t.rn <= cfg.lim THEN cfg.early_m ELSE cfg.def_m END,
           cfg.used + t.rn <= cfg.lim
      FROM todo t, cfg, subscription_plans p
     WHERE p.is_default`);
});

const count = async (table: string) =>
  ((await db.execute(sql.raw(`select count(*)::int as count from ${table}`))).rows[0] as { count: number }).count;
const pc = await count("provinces");
const dc = await count("districts");
console.log(`Seed tamamlandı: ${pc} il, ${dc} ilçe, ${SERVICE_TYPES.length} hizmet türü.`);
await pool.end();
