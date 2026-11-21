# İşletme bulma ve WhatsApp ile ulaşma

`npm run isletme:bul` Google Haritalar'dan işletmeleri (ör. berberleri) bulur. Her işletme için mesajı hazır yazılmış bir WhatsApp bağlantısı üretir.

**Mesajları otomatik göndermez.** Üretilen listede butona basınca WhatsApp açılır, gönder tuşuna sen basarsın. Bilerek böyle yapıldı: tanımadığın numaralara otomatik toplu mesaj atmak WhatsApp numaranın kapatılmasına yol açar.

## 1. Google Places API anahtarı (bir kez)

1. https://console.cloud.google.com adresinde bir proje oluştur. Faturalandırma (kredi kartı) eklemen gerekiyor ama aylık ücretsiz kota var.
2. **APIs & Services → Library** ekranında **Places API (New)**'i etkinleştir.
3. **APIs & Services → Credentials → Create credentials → API key** ile bir anahtar oluştur.
4. Anahtarı kısıtla:
   - **API restrictions:** yalnızca *Places API (New)*.
   - **Quotas:** *Places API (New)* için günlük istek sınırını düşük tut (ör. 100). Böylece yanlışlıkla ücret çıkmaz.
5. Proje klasöründeki `.env` dosyasına ekle:
   ```
   GOOGLE_PLACES_API_KEY=AIza...
   ```

**Maliyet:** Telefon numarası istendiği için arama, Text Search'ün *Enterprise* fiyat grubundan sayılır. Bu grubun aylık ücretsiz kotası birkaç yüz–bin istek düzeyindedir. Her istek en fazla 20 işletme döner, her sorgu en fazla 3 istek yapar (60 işletme). Güncel kota: https://developers.google.com/maps/billing-and-pricing/pricing

## 2. Kullanım

```bash
npm run isletme:bul -- --sorgu "Kadıköy berber"
npm run isletme:bul -- -s "Kadıköy berber" -s "Kadıköy erkek kuaförü" -s "Moda berber" --sadece-cep --min-puan 4
npm run isletme:bul -- -s "Çankaya berber" --mesaj-dosya mesaj.txt --haric yazilanlar.txt
```

| Seçenek | Açıklama |
| --- | --- |
| `--sorgu`, `-s` | Google'da aranacak metin. Birden fazla verilebilir. Her sorgu en fazla 60 sonuç döner, o yüzden büyük ilçeleri mahalle mahalle aramak daha çok sonuç verir. |
| `--mesaj`, `-m` | Mesaj şablonu. |
| `--mesaj-dosya` | Mesaj şablonunu bir dosyadan okur (çok satırlı mesajlar için daha rahat). |
| `--haric` | Daha önce yazdığın ya da "istemiyorum" diyen numaraların listesi. Her satırda bir numara, `#` sonrası yorum. |
| `--sadece-cep` | Yalnızca cep telefonu (5xx) olan işletmeleri listeler. Sabit hatlarda WhatsApp genelde yoktur. |
| `--min-puan` | Bu puanın altındaki işletmeleri çıkarır. |
| `--cikti`, `-o` | Çıktı klasörü (varsayılan `isletme-listeleri/`, git'e eklenmez). |

Şablonda şu yer tutucular kullanılabilir: `{isletme}`, `{adres}`, `{puan}`. Varsayılan mesaj Dijital Berber'i tanıtır ve "istemiyorum" yazma seçeneği sunar (`scripts/isletme-bul.ts` içindeki `VARSAYILAN_MESAJ`).

## 3. Çıktılar

- **`.html`:** Telefonda ya da bilgisayarda açılan liste. "WhatsApp'ta aç" butonu mesajı hazır yazılmış olarak WhatsApp'ı açar. "Gönderildi" işaretleri o tarayıcıda saklanır. Cep numaraları üstte, sabit hatlar uyarılı gösterilir.
- **`.csv`:** Excel'de açılabilen tablo (isim, telefon, puan, adres, harita, WhatsApp linki).

Listeyi telefonuna atıp oradan açarsan butonlar doğrudan WhatsApp uygulamasını açar. Bilgisayarda WhatsApp Web ya da masaüstü uygulaması açılır.

## 4. Dikkat edilecekler

- **Hız:** Günde birkaç düzineden fazla tanımadığın numaraya yazma. Kısa sürede çok mesaj atmak ve alıcıların "engelle / şikâyet et" demesi numaranın kısıtlanmasına yol açar. Mümkünse ayrı bir WhatsApp Business numarası kullan.
- **Yasal:** Ticari mesajlar 6563 sayılı Kanun kapsamındadır. Esnaf ve tacirlere gönderimde önceden onay aranmaz, ama ret hakkı tanımak zorunludur. Mesajda kim olduğunu yaz, "istemiyorum" diyenleri `--haric` dosyasına ekle ve bir daha yazma.
- **Veri:** Çıktılar telefon numarası içerir. Paylaşırken dikkat et, git'e ekleme (klasör `.gitignore`'da).
