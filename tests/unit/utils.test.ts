import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { formatTrPhone, normalizeTrPhone } from "@/lib/phone";
import { generateTempPassword, passwordSchema } from "@/server/auth/password";
import { businessProfileSchema, slugSchema } from "@/lib/validation/business";

describe("slugify", () => {
  it("Türkçe karakterleri dönüştürür", () => {
    expect(slugify("Şıkır Çağdaş Berber Öğüt")).toBe("sikir-cagdas-berber-ogut");
    expect(slugify("İstanbul  Kuaför & Salon!")).toBe("istanbul-kuafor-salon");
    expect(slugify("  --  ")).toBe("");
  });
});

describe("telefon", () => {
  it.each([
    ["0532 123 45 67", "+905321234567"],
    ["5321234567", "+905321234567"],
    ["+90 (532) 123-45-67", "+905321234567"],
    ["0090 532 123 45 67", "+905321234567"],
    ["0212 555 66 77", "+902125556677"],
  ])("%s → %s", (input, out) => expect(normalizeTrPhone(input)).toBe(out));

  it.each(["123", "0532 123 45", "0132 123 45 67", "abc"])("geçersiz: %s", (v) => expect(normalizeTrPhone(v)).toBeNull());

  it("biçimlendirir", () => expect(formatTrPhone("+905321234567")).toBe("0532 123 45 67"));
});

describe("şifre politikası", () => {
  it("zayıf şifreleri reddeder", () => {
    expect(passwordSchema.safeParse("kisa1").success).toBe(false);
    expect(passwordSchema.safeParse("sadeceharf").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("berber123").success).toBe(false);
  });
  it("uygun şifreyi kabul eder", () => expect(passwordSchema.safeParse("Makas2026kesim").success).toBe(true));
  it("geçici şifre politikaya uyar", () => {
    for (let i = 0; i < 50; i++) expect(passwordSchema.safeParse(generateTempPassword()).success).toBe(true);
  });
});

describe("işletme doğrulaması", () => {
  const base = { name: "Berber", phone: "0532 123 45 67", email: "Berber@Ornek.com", addressLine: "Adres satırı", provinceId: "34", districtId: "1" };
  it("rezerve slug'ı reddeder", () => {
    expect(slugSchema.safeParse("admin").success).toBe(false);
    expect(slugSchema.safeParse("Büyük Harf").success).toBe(false);
    expect(slugSchema.safeParse("ahmet-usta").success).toBe(true);
  });
  it("tek koordinatı reddeder", () => {
    expect(businessProfileSchema.safeParse({ ...base, latitude: "41.0" }).success).toBe(false);
    expect(businessProfileSchema.safeParse({ ...base, latitude: "41.0", longitude: "29.0" }).success).toBe(true);
  });
  it("Türkiye dışı koordinatı reddeder", () => {
    expect(businessProfileSchema.safeParse({ ...base, latitude: "51.5", longitude: "-0.1" }).success).toBe(false);
  });
  it("telefonu normalize eder", () => {
    const r = businessProfileSchema.parse(base);
    expect(r.phone).toBe("+905321234567");
    expect(r.email).toBe("berber@ornek.com");
    expect(r.provinceId).toBe(34);
  });
});

import { isPdf } from "@/server/modules/billing/invoices";
import { sniffDocument } from "@/server/modules/business/documents";
import { reviewSchema } from "@/server/modules/admin/documents";

describe("dosya türü tespiti", () => {
  it("PDF içerikten tanınır, uzantıya bakılmaz", () => {
    expect(isPdf(Buffer.from("%PDF-1.7\n..."))).toBe(true);
    expect(isPdf(Buffer.from("<html>%PDF-"))).toBe(false);
  });
  it("belge: PDF/JPEG/PNG kabul, diğerleri red", () => {
    expect(sniffDocument(Buffer.from("%PDF-1.4 xxxx"))?.mime).toBe("application/pdf");
    expect(sniffDocument(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0]))?.mime).toBe("image/jpeg");
    expect(sniffDocument(Buffer.from("GIF89a......"))).toBeNull();
  });
  it("ret için gerekçe zorunlu", () => {
    expect(reviewSchema.safeParse({ decision: "REJECTED" }).success).toBe(false);
    expect(reviewSchema.safeParse({ decision: "REJECTED", note: "Okunmuyor" }).success).toBe(true);
    expect(reviewSchema.safeParse({ decision: "APPROVED" }).success).toBe(true);
  });
});

import { safeNext } from "@/lib/safe-next";

describe("giriş sonrası yönlendirme güvenliği", () => {
  it.each([
    ["/berber/x/randevu?h=1&t=2030-01-01", "/berber/x/randevu?h=1&t=2030-01-01"],
    ["https://kotu.site", "/hesabim"],
    ["//kotu.site/a", "/hesabim"],
    ["/\\kotu.site", "/hesabim"],
    ["/admin", "/hesabim"],
    ["/isletme/panel", "/hesabim"],
    [undefined, "/hesabim"],
  ])("%s → %s", (v, out) => expect(safeNext(v)).toBe(out));
});
