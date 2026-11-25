import { execFileSync } from "node:child_process";
import { Pool } from "pg";

export const E2E_ADMIN = { email: "e2e-admin@test.local", password: "E2eYonetici2026" };

/** E2E veritabanını sıfırlar, migration + seed + test yöneticisi oluşturur. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_e2e";
  if (!/_e2e\b/.test(url)) throw new Error("Güvenlik: E2E veritabanı adı _e2e içermeli");
  const admin = new Pool({ connectionString: url.replace(/\/[^/]+$/, "/postgres") });
  const dbName = url.split("/").pop()!;
  const exists = await admin.query("select 1 from pg_database where datname = $1", [dbName]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();
  const pool = new Pool({ connectionString: url });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await pool.end();
  const env = { ...process.env, DATABASE_URL: url, ADMIN_EMAIL: E2E_ADMIN.email, ADMIN_PASSWORD: E2E_ADMIN.password, ADMIN_NAME: "E2E Yönetici" };
  for (const s of ["scripts/migrate.ts", "scripts/seed.ts", "scripts/create-admin.ts"]) execFileSync("npx", ["tsx", s], { env, stdio: "inherit" });
  // Pazaryeri akışları test edildiği için lansman modu (az berberde listeleri gizler) testlerde kapalı
  const p2 = new Pool({ connectionString: url });
  await p2.query(`INSERT INTO platform_settings (key, value) VALUES ('marketplace.launchMode', '{"enabled": false, "autoOpenAt": 30}'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
  await p2.end();
}
