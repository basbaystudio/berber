/**
 * Google Haritalar'dan işletme bulur ve her biri için mesajı hazır yazılmış WhatsApp bağlantısı üretir.
 * Mesajlar otomatik GÖNDERİLMEZ: üretilen HTML listesinde butona basınca WhatsApp açılır, gönder tuşuna siz basarsınız.
 *
 * Kullanım:
 *   GOOGLE_PLACES_API_KEY=... npm run isletme:bul -- --sorgu "Kadıköy berber" --sorgu "Üsküdar berber"
 *
 * Seçenekler:
 *   --sorgu, -s     Google'da aranacak metin (birden fazla verilebilir). Her sorgu en fazla 60 sonuç döner.
 *   --mesaj, -m     Mesaj şablonu ({isletme}, {adres}, {puan} yer tutucuları kullanılabilir)
 *   --mesaj-dosya   Mesaj şablonunu bir metin dosyasından oku
 *   --haric         Daha önce yazılan / "istemiyorum" diyen numaraların listesi (her satırda bir numara)
 *   --sadece-cep    Yalnızca cep telefonu (5xx) olan işletmeleri listele
 *   --min-puan      Bu puanın altındaki işletmeleri çıkar (ör. 4)
 *   --cikti, -o     Çıktı klasörü (varsayılan: isletme-listeleri)
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadEnv } from "./env";
import {
  csvOlustur,
  haricListesiOku,
  htmlOlustur,
  temizle,
  yeriDonustur,
  type GoogleYer,
  type Isletme,
} from "./isletme-bul/lib";

const VARSAYILAN_MESAJ = `Merhaba {isletme},

Ben Dijital Berber'den (dijitalberber.com) yazıyorum. Berberler için online randevu ve işletme yönetimi platformu kurduk: müşterileriniz 7/24 internetten randevu alabiliyor, siz de takviminizi tek ekrandan yönetiyorsunuz.

İlginizi çekerse kısaca anlatmak isterim. İstemezseniz "istemiyorum" yazmanız yeterli, bir daha rahatsız etmem.

İyi çalışmalar!`;

const ALANLAR = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

async function ara(sorgu: string, apiKey: string): Promise<Isletme[]> {
  const sonuc: Isletme[] = [];
  let pageToken: string | undefined;
  for (let sayfa = 0; sayfa < 3; sayfa++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": ALANLAR,
      },
      body: JSON.stringify({ textQuery: sorgu, languageCode: "tr", regionCode: "TR", pageSize: 20, pageToken }),
    });
    if (!res.ok) {
      const metin = await res.text();
      throw new Error(`Google Places API hatası (${res.status}): ${metin.slice(0, 500)}`);
    }
    const veri = (await res.json()) as { places?: GoogleYer[]; nextPageToken?: string };
    for (const y of veri.places ?? []) sonuc.push(yeriDonustur(y, sorgu));
    if (!veri.nextPageToken) break;
    pageToken = veri.nextPageToken;
  }
  return sonuc;
}

function dosyaAdi(s: string): string {
  return (
    s
      .toLocaleLowerCase("tr")
      .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]!)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "liste"
  );
}

async function main() {
  loadEnv();
  const { values } = parseArgs({
    options: {
      sorgu: { type: "string", short: "s", multiple: true },
      mesaj: { type: "string", short: "m" },
      "mesaj-dosya": { type: "string" },
      haric: { type: "string" },
      "sadece-cep": { type: "boolean", default: false },
      "min-puan": { type: "string" },
      cikti: { type: "string", short: "o", default: "isletme-listeleri" },
      yardim: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.yardim || !values.sorgu?.length) {
    console.log('Kullanım: npm run isletme:bul -- --sorgu "Kadıköy berber" [--sorgu "..."] [--sadece-cep] [--min-puan 4] [--haric yazilanlar.txt] [--mesaj-dosya mesaj.txt]');
    process.exit(values.yardim ? 0 : 1);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_PLACES_API_KEY tanımlı değil. .env dosyasına ekleyin (kurulum: docs/ISLETME-BULMA.md).");
    process.exit(1);
  }

  const sablon = values["mesaj-dosya"]
    ? fs.readFileSync(values["mesaj-dosya"], "utf8").trim()
    : (values.mesaj ?? VARSAYILAN_MESAJ);
  const haric = values.haric && fs.existsSync(values.haric) ? haricListesiOku(fs.readFileSync(values.haric, "utf8")) : new Set<string>();
  const minPuan = values["min-puan"] ? Number(values["min-puan"].replace(",", ".")) : null;

  let hepsi: Isletme[] = [];
  for (const sorgu of values.sorgu) {
    process.stdout.write(`"${sorgu}" aranıyor... `);
    const bulunan = await ara(sorgu, apiKey);
    console.log(`${bulunan.length} sonuç`);
    hepsi.push(...bulunan);
  }

  let liste = temizle(hepsi, haric);
  if (values["sadece-cep"]) liste = liste.filter((i) => i.cep);
  if (minPuan != null && !Number.isNaN(minPuan)) liste = liste.filter((i) => i.puan == null || i.puan >= minPuan);
  // Önce cep numarası olanlar, sonra çok yorumlu olanlar
  liste.sort((a, b) => Number(b.cep) - Number(a.cep) || (b.yorumSayisi ?? 0) - (a.yorumSayisi ?? 0));

  const klasor = path.resolve(values.cikti!);
  fs.mkdirSync(klasor, { recursive: true });
  const tarih = new Date().toISOString().slice(0, 10);
  const ad = `${tarih}-${dosyaAdi(values.sorgu.join(" "))}`;
  const baslik = values.sorgu.join(" · ");
  fs.writeFileSync(path.join(klasor, `${ad}.html`), htmlOlustur(liste, sablon, baslik));
  fs.writeFileSync(path.join(klasor, `${ad}.csv`), csvOlustur(liste, sablon));

  const cep = liste.filter((i) => i.cep).length;
  const telefonsuz = liste.filter((i) => !i.whatsappNo).length;
  console.log(`\n${liste.length} işletme (${cep} cep, ${liste.length - cep - telefonsuz} sabit hat, ${telefonsuz} telefonsuz)`);
  if (haric.size) console.log(`${haric.size} numara hariç tutuldu.`);
  console.log(`Liste:  ${path.join(klasor, `${ad}.html`)}`);
  console.log(`Excel:  ${path.join(klasor, `${ad}.csv`)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
