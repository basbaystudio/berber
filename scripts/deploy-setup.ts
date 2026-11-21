/**
 * Vercel'de her canlı (production) dağıtımda, derlemeden önce çalışır (package.json → vercel-build):
 * 1. Veritabanı tablolarını günceller (migration).
 * 2. Referans verilerini yükler (il/ilçe, hizmet türleri, ayarlar) — tekrar çalıştırılabilir.
 * 3. ADMIN_EMAIL + ADMIN_PASSWORD tanımlıysa ve bu e-postayla yönetici YOKSA ilk yöneticiyi oluşturur.
 *    Var olan yöneticinin şifresine dokunmaz. İlk girişten sonra ADMIN_PASSWORD'ü Vercel'den silebilirsiniz.
 * Önizleme dağıtımlarında hiçbir şey yapmaz (canlı veritabanına dokunmasın diye).
 */
import { execSync } from "node:child_process";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { hash } from "@node-rs/argon2";
import * as schema from "../src/server/db/schema";

const env = process.env.VERCEL_ENV;
if (env && env !== "production") {
  console.log(`Dağıtım ortamı "${env}": veritabanı kurulumu atlandı.`);
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil. Vercel → Settings → Environment Variables bölümünden ekleyin.");
  process.exit(1);
}

execSync("npx tsx scripts/migrate.ts", { stdio: "inherit" });
execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
if (email && password) {
  if (password.length < 12 || !/\d/.test(password) || !/[A-Za-z]/.test(password)) {
    console.error("ADMIN_PASSWORD en az 12 karakter olmalı ve harf + rakam içermeli.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const existing = await db.execute(sql`select id from platform_admins where lower(email) = ${email}`);
  if (existing.rows.length) {
    console.log(`Yönetici zaten var: ${email} (şifre değiştirilmedi).`);
  } else {
    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
    await db.insert(schema.platformAdmins).values({ email, name: process.env.ADMIN_NAME?.trim() || "Platform Yöneticisi", passwordHash });
    console.log(`İlk yönetici oluşturuldu: ${email}`);
  }
  await pool.end();
}
console.log("Veritabanı hazır.");
