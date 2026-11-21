import { z } from "zod";
import { normalizeTrPhone } from "../phone";

/** Boş string → undefined (opsiyonel form alanları için) */
export const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} gerekli.` })
    .trim()
    .min(min, min <= 1 ? `${label} gerekli.` : `${label} en az ${min} karakter olmalı.`)
    .max(max, `${label} en fazla ${max} karakter olabilir.`);

export const optionalText = (max: number, label: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir.`).optional());

export const trPhone = z
  .string({ error: "Telefon gerekli." })
  .trim()
  .min(1, "Telefon gerekli.")
  .transform((v, ctx) => {
    const n = normalizeTrPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir telefon numarası girin (örn. 0532 123 45 67)." });
      return z.NEVER;
    }
    return n;
  });

export const email = z.string({ error: "E-posta gerekli." }).trim().toLowerCase().max(254).email("Geçerli bir e-posta adresi girin.");

export const uuid = z.string().uuid("Geçersiz kimlik.");

export const intFromForm = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    z.number({ error: `${label} seçin.` }).int(`${label} seçin.`).positive(`${label} seçin.`),
  );

export const optionalCoord = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.replace(",", "."))) : v),
    z.number({ error: `${label} sayı olmalı.` }).min(min, `${label} Türkiye sınırları dışında.`).max(max, `${label} Türkiye sınırları dışında.`).optional(),
  );

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
