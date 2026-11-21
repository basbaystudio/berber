import "server-only";

type Level = "info" | "warn" | "error";

/** Yapılandırılmış JSON log (Vercel log'larında okunabilir). Kişisel veri log'lanmaz. */
function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...meta });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, err?: unknown, meta?: Record<string, unknown>) =>
    log("error", msg, {
      ...meta,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
    }),
};
