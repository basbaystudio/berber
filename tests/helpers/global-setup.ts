import { execFileSync } from "node:child_process";
import { Pool } from "pg";

/** Test veritabanını sıfırdan kurar: şemayı siler, migration + seed çalıştırır. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_test";
  if (!/_test\b/.test(url)) throw new Error(`Güvenlik: test veritabanı adı "_test" içermeli (${url})`);
  const pool = new Pool({ connectionString: url });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await pool.end();
  const env = { ...process.env, DATABASE_URL: url };
  execFileSync("npx", ["tsx", "scripts/migrate.ts"], { env, stdio: "inherit" });
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { env, stdio: "inherit" });
}
