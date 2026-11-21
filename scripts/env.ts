import fs from "node:fs";

/** .env / .env.local dosyalarını basitçe yükler (script'ler için). Mevcut ortam değişkenlerini ezmez. */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, raw] = m;
      if (process.env[k!] !== undefined) continue;
      process.env[k!] = raw!.replace(/^["']|["']$/g, "");
    }
  }
  process.env.DATABASE_URL ??= "postgres://berber:berber@localhost:5432/berber";
}
