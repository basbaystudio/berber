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
});

const count = async (table: string) =>
  ((await db.execute(sql.raw(`select count(*)::int as count from ${table}`))).rows[0] as { count: number }).count;
const pc = await count("provinces");
const dc = await count("districts");
console.log(`Seed tamamlandı: ${pc} il, ${dc} ilçe, ${SERVICE_TYPES.length} hizmet türü.`);
await pool.end();
