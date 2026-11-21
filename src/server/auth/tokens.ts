import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256 bit rastgele, URL uyumlu token. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Veritabanında saklanan değer: token'ın SHA-256 hash'i. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
