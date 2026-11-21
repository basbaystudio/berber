/**
 * Platform yöneticisi oluşturur ya da şifresini günceller.
 * Kullanım: ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... npm run admin:create
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { hash } from "@node-rs/argon2";
import { loadEnv } from "./env";
import * as schema from "../src/server/db/schema";

loadEnv();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Platform Yöneticisi";
const password = process.env.ADMIN_PASSWORD ?? "";
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Geçerli bir ADMIN_EMAIL gerekli.");
if (password.length < 12 || !/\d/.test(password) || !/[A-Za-z]/.test(password))
  throw new Error("ADMIN_PASSWORD en az 12 karakter olmalı ve harf + rakam içermeli.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
const existing = await db.execute(sql`select id from platform_admins where lower(email) = ${email}`);
if (existing.rows.length) {
  await db.execute(sql`update platform_admins set password_hash = ${passwordHash}, name = ${name}, is_active = true where lower(email) = ${email}`);
} else {
  await db.insert(schema.platformAdmins).values({ email, name, passwordHash });
}
console.log(`Yönetici hazır: ${email}`);
await pool.end();
