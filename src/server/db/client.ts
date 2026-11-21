import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
/** Transaction içinde ya da dışında kullanılabilen sorgu arayüzü. */
export type Executor = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __berberPool?: Pool; __berberDb?: DB };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tanımlı değil");
  return new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 5), idleTimeoutMillis: 10_000 });
}

export function getPool(): Pool {
  if (!globalForDb.__berberPool) globalForDb.__berberPool = createPool();
  return globalForDb.__berberPool;
}

export const db: DB = globalForDb.__berberDb ?? drizzle(getPool(), { schema, casing: undefined });
globalForDb.__berberDb = db;

export { schema };
