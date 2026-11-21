export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "LIMIT_REACHED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  ACCOUNT_DISABLED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LIMIT_REACHED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** Kullanıcıya gösterilebilecek, beklenen hata. Mesaj her zaman Türkçe ve güvenlidir. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = fieldErrors;
  }
}

export const notFound = (what = "Kayıt") => new AppError("NOT_FOUND", `${what} bulunamadı.`);

/** PostgreSQL hata kodu yardımcıları */
export function pgErrorCode(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if (typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string") {
      const code = (e as { code: string }).code;
      if (/^[0-9A-Z]{5}$/.test(code)) return code;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export function pgConstraint(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if (typeof e === "object" && e !== null && "constraint" in e) return (e as { constraint?: string }).constraint;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export const PG = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  EXCLUSION_VIOLATION: "23P01",
} as const;
