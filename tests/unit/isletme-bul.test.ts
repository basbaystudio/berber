import { describe, expect, it } from "vitest";
import {
  csvOlustur,
  cepMi,
  haricListesiOku,
  htmlOlustur,
  mesajOlustur,
  temizle,
  whatsappLinki,
  whatsappNumarasi,
  yeriDonustur,
} from "../../scripts/isletme-bul/lib";

describe("whatsappNumarasi", () => {
  it("Türkiye numaralarını 90 önekli biçime çevirir", () => {
    expect(whatsappNumarasi("0532 123 45 67")).toBe("905321234567");
    expect(whatsappNumarasi("+90 532 123 45 67")).toBe("905321234567");
    expect(whatsappNumarasi("(0216) 555 44 33")).toBe("902165554433");
    expect(whatsappNumarasi("5321234567")).toBe("905321234567");
    expect(whatsappNumarasi("0090 532 123 4567")).toBe("905321234567");
  });
  it("geçersiz ve boş değerlerde null döner", () => {
    expect(whatsappNumarasi(null)).toBeNull();
    expect(whatsappNumarasi("")).toBeNull();
    expect(whatsappNumarasi("444 1 234")).toBeNull();
  });
  it("yabancı numaraları olduğu gibi bırakır", () => {
    expect(whatsappNumarasi("+49 30 1234567")).toBe("49301234567");
  });
  it("cep ve sabit hattı ayırır", () => {
    expect(cepMi("905321234567")).toBe(true);
    expect(cepMi("902165554433")).toBe(false);
    expect(cepMi(null)).toBe(false);
  });
});

describe("mesaj ve bağlantı", () => {
  it("yer tutucuları doldurur ve bağlantıyı kodlar", () => {
    const m = mesajOlustur("Merhaba {isletme} ({puan})", { ad: "Ali & Veli Berber", adres: "", puan: 4.7 });
    expect(m).toBe("Merhaba Ali & Veli Berber (4.7)");
    expect(whatsappLinki("905321234567", m)).toBe(
      "https://wa.me/905321234567?text=Merhaba%20Ali%20%26%20Veli%20Berber%20(4.7)",
    );
  });
});

describe("temizle", () => {
  const yer = (id: string, tel?: string, durum?: string) =>
    yeriDonustur({ id, displayName: { text: id }, nationalPhoneNumber: tel, businessStatus: durum }, "q");

  it("tekrarları, kapanmışları ve hariç numaraları çıkarır", () => {
    const liste = [
      yer("a", "0532 111 11 11"),
      yer("a", "0532 111 11 11"),
      yer("b", "0532 111 11 11"), // aynı numara, farklı kayıt
      yer("c", "0533 222 22 22", "CLOSED_PERMANENTLY"),
      yer("d", "0534 333 33 33"),
      yer("e"),
    ];
    const haric = haricListesiOku("# yazılanlar\n0534 333 33 33  # istemiyor\n");
    expect(temizle(liste, haric).map((i) => i.id)).toEqual(["a", "e"]);
  });
});

describe("çıktılar", () => {
  const i = yeriDonustur(
    { id: "x1", displayName: { text: 'Kuaför "<Ayşe>"' }, nationalPhoneNumber: "0532 123 45 67", formattedAddress: "Moda; Kadıköy" },
    "Kadıköy kuaför",
  );

  it("CSV'yi ; ayraçlı, BOM'lu ve kaçışlı üretir", () => {
    const csv = csvOlustur([i], "Merhaba {isletme}");
    expect(csv.startsWith("﻿İşletme;")).toBe(true);
    expect(csv).toContain('"Kuaför ""<Ayşe>"""');
    expect(csv).toContain('"Moda; Kadıköy"');
    expect(csv).toContain("https://wa.me/905321234567?text=");
  });

  it("HTML'de işletme adını kaçışlar", () => {
    const sayfa = htmlOlustur([i], "Merhaba {isletme}", "Test");
    expect(sayfa).not.toContain("<Ayşe>");
    expect(sayfa).toContain("&lt;Ayşe&gt;");
    expect(sayfa).toContain("https://wa.me/905321234567?text=");
  });
});
