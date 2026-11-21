import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { AppError } from "./errors";
import { logger } from "./logger";

export type ActionState<T = undefined> =
  | { status: "idle" }
  | { status: "success"; message?: string; data?: T }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export const idle: ActionState = { status: "idle" };

/** Zod hatalarını alan → ilk mesaj sözlüğüne çevirir. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** FormData'yı düz nesneye çevirir (aynı isimli birden çok alan dizi olur). */
export function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? value : value;
    if (key in obj) {
      const cur = obj[key];
      obj[key] = Array.isArray(cur) ? [...cur, v] : [cur, v];
    } else obj[key] = v;
  }
  return obj;
}

/**
 * Server action gövdesini merkezi hata yönetimiyle çalıştırır.
 * - AppError → kullanıcıya gösterilen Türkçe mesaj
 * - ZodError → alan hataları
 * - Diğer her şey → log + genel mesaj (iç detay sızdırılmaz)
 * - redirect()/notFound() gibi Next.js kontrol akışları olduğu gibi iletilir.
 */
export async function runAction<T>(fn: () => Promise<ActionState<T> | void>): Promise<ActionState<T>> {
  try {
    const res = await fn();
    return res ?? { status: "success" };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError) return { status: "error", message: err.message, fieldErrors: err.fieldErrors };
    if (err instanceof z.ZodError)
      return { status: "error", message: "Lütfen formdaki hataları düzeltin.", fieldErrors: zodFieldErrors(err) };
    logger.error("action_failed", err);
    return { status: "error", message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." };
  }
}

/** Zod şemasıyla doğrular, hata durumunda AppError(VALIDATION) fırlatır. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new AppError("VALIDATION", "Lütfen formdaki hataları düzeltin.", zodFieldErrors(r.error));
  return r.data;
}
