import { z } from "zod";
import { checkbox, optionalCoord, optionalText, intFromForm, trimmed, trPhone, emptyToUndefined } from "./common";

const RESERVED_SLUGS = new Set([
  "admin", "isletme", "giris", "kayit", "hesabim", "api", "ara", "berber", "panel", "yardim", "iletisim", "hakkimizda",
  "kvkk", "gizlilik", "kosullar", "randevu", "sifre", "cikis", "static", "public", "assets",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Bağlantı adı en az 3 karakter olmalı.")
  .max(80, "Bağlantı adı en fazla 80 karakter olabilir.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Yalnızca küçük harf, rakam ve tire kullanın (örn. kuafor-ahmet).")
  .refine((s) => !RESERVED_SLUGS.has(s), "Bu bağlantı adı sistem tarafından kullanılıyor.");

export const loginSchema = z
  .string({ error: "Kullanıcı adı gerekli." })
  .trim()
  .toLowerCase()
  .min(3, "Kullanıcı adı en az 3 karakter olmalı.")
  .max(64, "Kullanıcı adı en fazla 64 karakter olabilir.")
  .regex(/^[a-z0-9._@-]+$/, "Kullanıcı adında yalnızca harf, rakam, nokta, tire, alt çizgi ve @ kullanılabilir.");

/** İşletme profil alanları (admin oluşturur / düzenler). */
export const businessProfileSchema = z
  .object({
    name: trimmed(2, 80, "İşletme adı"),
    slug: z.preprocess(emptyToUndefined, slugSchema.optional()),
    phone: trPhone,
    description: optionalText(1000, "Açıklama"),
    addressLine: trimmed(5, 300, "Adres"),
    provinceId: intFromForm("İl"),
    districtId: intFromForm("İlçe"),
    latitude: optionalCoord(35.5, 42.5, "Enlem"),
    longitude: optionalCoord(25.5, 45, "Boylam"),
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: "Konum için enlem ve boylamın ikisi de girilmeli.",
    path: ["latitude"],
  });

export const createBusinessSchema = businessProfileSchema.and(
  z.object({
    ownerName: trimmed(2, 80, "Yetkili adı"),
    login: loginSchema,
  }),
);

export const ownerAccountSchema = z.object({
  ownerName: trimmed(2, 80, "Yetkili adı"),
  login: loginSchema,
  isActive: checkbox,
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
