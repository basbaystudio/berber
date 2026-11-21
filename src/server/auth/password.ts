import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

// OWASP önerisi: Argon2id, m=19 MiB, t=2, p=1
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Kullanıcı yokken de aynı süreyi harcamak için (kullanıcı adı tahmini / zamanlama saldırısına karşı). */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword("zamanlama-esitleme-icin-sahte-sifre");
  await verifyPassword(await dummyHash, password);
}

const COMMON = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "qwerty123", "11111111", "00000000",
  "sifre123", "şifre123", "parola123", "asdasdasd", "abc12345", "12341234", "iloveyou", "galatasaray",
  "fenerbahce", "besiktas", "trabzonspor", "berber123", "qwertyui", "1q2w3e4r", "aa123456", "türkiye1",
]);

export const passwordSchema = z
  .string({ error: "Şifre gerekli." })
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(128, "Şifre en fazla 128 karakter olabilir.")
  .refine((p) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p) && /\d/.test(p), "Şifre en az bir harf ve bir rakam içermeli.")
  .refine((p) => !COMMON.has(p.toLocaleLowerCase("tr-TR")), "Bu şifre çok yaygın, lütfen başka bir şifre seçin.");

/** Admin'in işletmeye vereceği geçici şifre (karışabilecek karakterler yok). */
export function generateTempPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let out = "";
    for (const b of bytes) out += alphabet[b % alphabet.length];
    if (/\d/.test(out) && /[A-Za-z]/.test(out)) return out;
  }
}
