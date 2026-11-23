# Güzellik Salonları için Yapay Zekâ Asistanı — Proje Planı

> Hazırlanma: Kasım 2026 · Durum: Taslak plan
> Kapsam: WhatsApp + Instagram üzerinden çalışan Claude tabanlı müşteri asistanı, otomasyonlar ve salon web paneli.
> Bu plan mevcut **Dijital Berber** kod tabanının (Next.js + PostgreSQL + Vercel) üzerine kurulur. Randevu, çalışan, hizmet ve müsaitlik altyapısı zaten var.

⚠️ **Fiyatlar ve limitler hakkında:** Meta (WhatsApp/Instagram) ve Google fiyatları ve limitleri sık değişir. Aşağıdaki rakamlar planlama için yaklaşık değerlerdir. Canlıya çıkmadan önce şu sayfalardan güncel hallerine bakılmalı:
- WhatsApp fiyatları: developers.facebook.com/docs/whatsapp/pricing
- WhatsApp mesaj limitleri: developers.facebook.com/docs/whatsapp/messaging-limits
- Claude API fiyatları: platform.claude.com/docs/en/about-claude/pricing

---

## 1. Hizmet Kapsamı (Modüller)

| # | Modül | Ne yapar | Kanal |
|---|---|---|---|
| 1 | **WhatsApp müşteri hizmetleri** | 7/24 soruları yanıtlar (fiyat, adres, hizmet detayı, çalışma saati). Gerekirse konuşmayı salon çalışanına devreder. | WhatsApp |
| 2 | **Randevu oluşturma** | Müsait saatleri gösterir, randevu açar, iptal eder, saatini değiştirir. Mevcut müsaitlik motorunu kullanır. | WhatsApp, Instagram, web |
| 3 | **Randevu hatırlatma** | Randevudan 24 saat ve 2 saat önce onay butonlu hatırlatma gönderir ("Geliyorum / İptal / Saat değiştir"). | WhatsApp |
| 4 | **Boş randevu doldurma** | İptal olan saati; bekleme listesine, o hizmetin zamanı gelmiş müşterilere ya da "son dakika" listesine sırayla teklif eder. | WhatsApp |
| 5 | **İşlem sonrası yan ürün önerisi** | Hizmet bitince ona uygun ürünü ya da bakımı önerir. Örnek: cilt bakımından sonra serum, keratinden sonra tuzsuz şampuan. | WhatsApp |
| 6 | **İşlem önerme / tekrar hatırlatma** | Hizmetin tekrar zamanı gelince hatırlatır. Örnek: protez tırnak dolgusu 3 hafta, lazer seansı 6 hafta, kaş-kirpik 4 hafta. | WhatsApp |
| 7 | **Google puanlama hatırlatıcısı** | İşlemden 2-3 saat sonra Google yorum bağlantısını gönderir. | WhatsApp |
| 8 | **Özel indirim tanımlama** | Müşteriye özel kupon tanımlanır: doğum günü, sadakat, uzun süredir gelmeyen müşteriyi geri kazanma. Asistan bu kuponları tanır ve uygular. | Panel + WhatsApp |
| 9 | **Kampanya bilgisi / toplu gönderim** | Seçilen müşteri grubuna (son 90 günde gelenler, sadece lazer müşterileri vb.) kampanya mesajı gönderir. Asistan gelen kampanya sorularını da yanıtlar. | WhatsApp |
| 10 | **Salon web paneli** | Gelen kutusu (tüm konuşmalar), takvim, otomasyon ayarları, kampanyalar, raporlar. | Web |
| 11 | **Çalışan yönetimi** | Çalışanlar, vardiyalar, yetkinlikler, prim/komisyon raporu, panel yetkileri (sahip/yönetici/çalışan). | Web |
| +++ | **Salon web sitesi** | `salonadi.dijitalberber.com` ya da salonun kendi alan adı. Online randevu sayfası içerir. | Web |
| +++ | **Instagram mesaj takibi** | DM'ler ve yorumlar aynı gelen kutusuna düşer. Asistan DM'leri yanıtlar. Yorumlara özelden cevap yazabilir. | Instagram |

---

## 2. Genel Mimari

```
 Müşteri (WhatsApp / Instagram DM / Web)
          │
          ▼
 Meta Webhook  ──►  /api/webhooks/meta  (imza doğrulama: X-Hub-Signature-256)
                          │  mesajı DB'ye yaz, 200 dön (birkaç saniye içinde)
                          ▼
                    İş kuyruğu (queue)
                          │
                          ▼
              AI Asistan Çalışanı (Claude API + araçlar)
                 │ araçlar (tool use):
                 │  • hizmetleri_listele / fiyat_getir
                 │  • musait_saatleri_bul   → mevcut availability modülü
                 │  • randevu_olustur / iptal / degistir → booking modülü
                 │  • kampanya_ve_kupon_getir
                 │  • musteri_gecmisi_getir
                 │  • insana_devret   (konuşmayı panelde "bekliyor" yapar)
                          ▼
              WhatsApp Cloud API / Instagram Send API ile yanıt
                          │
 Zamanlayıcı (cron + kuyruk) ──► hatırlatma, Google yorum, tekrar işlem, kampanya
                          │
                Salon Web Paneli (gelen kutusu, takvim, ayarlar)
```

**Önemli tasarım kararları**

- **Asistan yalnızca araçlarla randevu açabilir.** Saatleri kendisi tahmin etmez. Müsaitlik her zaman veritabanından gelir. Çakışmaları mevcut exclusion constraint zaten engelliyor.
- **İnsan devri:** Bir çalışan panelden konuşmaya yazdığında asistan o konuşmada X saat susar. Müşteri "yetkiliyle görüşmek istiyorum" derse ya da şikâyet algılanırsa konuşma otomatik devredilir.
- **Her salonun kendi bilgi bankası olur:** hizmetler, fiyatlar, SSS, kampanyalar, üslup ("siz" mi "sen" mi, emoji kullanılsın mı). Bunlar sistem istemine (system prompt) eklenir ve önbelleğe alınır (prompt caching). Böylece maliyet ciddi düşer.
- **Webhook hızlı dönmeli:** Meta yanıt bekler. Mesaj DB'ye yazılır ve kuyruğa atılır. Yapay zekâ işi arka planda çalışır. Kuyruk için Vercel Queues, Upstash QStash ya da Inngest gibi bir servis kullanılabilir.
- **Zamanlanmış işler:** Mevcut günlük cron yetmez. Hatırlatmalar dakika hassasiyeti ister. Bunun için Vercel Pro'da 1-5 dakikalık bir cron ya da kuyruk servisinin gecikmeli mesajı (delayed message) kullanılmalı.

### Yeni veritabanı tabloları (özet)

| Tablo | İçerik |
|---|---|
| `channels` | salon_id, tür (whatsapp/instagram), waba_id, phone_number_id, ig_user_id, **şifreli** erişim token'ı, durum |
| `contacts` | telefon / IG kimliği, müşteri eşleşmesi, **pazarlama izni (opt-in) + izin tarihi + kaynağı**, İYS durumu |
| `conversations` | kanal, müşteri, durum (asistan / insan / kapalı), atanan çalışan, son 24 saat penceresi bitişi |
| `messages` | yön, içerik, medya, Meta mesaj kimliği, iletim durumu (gönderildi/iletildi/okundu/hata) |
| `message_templates` | şablon adı, kategori (utility/marketing), dil, Meta onay durumu |
| `automations` | tür (hatırlatma, google_yorum, tekrar_islem, yan_urun, geri_kazanma), açık/kapalı, zamanlama, şablon |
| `scheduled_jobs` | ne zaman, hangi müşteriye, hangi otomasyon, durum (tekrar gönderimi önlemek için idempotency anahtarı) |
| `campaigns`, `campaign_recipients` | segment, şablon, gönderim, tıklama, randevuya dönüşüm |
| `coupons` | kod, müşteriye özel mi, indirim, geçerlilik, kullanım limiti |
| `service_followups` | hizmet → tekrar süresi (gün), önerilen yan ürünler |
| `waitlist` | müşteri, hizmet, tercih edilen gün/saat aralığı |
| `ai_usage` | salon bazında token ve maliyet takibi (aylık limit için) |

---

## 3. Aylık API Limitleri ve Maliyetler

### 3.1 WhatsApp Business Platform (Cloud API, Meta)

**Ücretlendirme (Temmuz 2025'ten beri mesaj başına):**

| Mesaj türü | Ne zaman | Ücret (Türkiye, yaklaşık) |
|---|---|---|
| **Servis mesajı** | Müşteri yazdıktan sonraki 24 saat içinde verilen tüm serbest yanıtlar | **Ücretsiz, sınırsız** |
| **Utility (hizmet) şablonu** | Randevu onayı, hatırlatma, iptal bildirimi | ~0,005 $ / mesaj. **24 saat penceresi açıkken ücretsiz.** |
| **Marketing (pazarlama) şablonu** | Kampanya, yan ürün önerisi, geri kazanma, büyük ihtimalle Google yorum isteği de | ~0,01 $ / mesaj |
| **Authentication** | OTP / doğrulama kodu | ~0,008 $ / mesaj |
| Reklamdan gelen sohbet (Click-to-WhatsApp) | Instagram/Facebook reklamından gelen müşteri | 72 saat boyunca tüm mesajlar ücretsiz |

> Türkiye, Meta'nın en ucuz bölgelerinden biri. Kesin rakamı Meta'nın ülke fiyat tablosundan kontrol edin. Ödeme USD ile yapılır.

**Gönderim limitleri (mesaj limiti seviyesi):** Bu limit, sizin başlattığınız şablon mesajlarla 24 saatte kaç farklı kişiye ulaşabileceğinizi belirler. Müşterinin başlattığı sohbetler bu limite dahil değildir.

| Seviye | Koşul | 24 saatte ulaşılabilecek farklı kişi |
|---|---|---|
| Başlangıç | İşletme doğrulaması yok | **250** |
| Doğrulanmış | Meta işletme doğrulaması tamam + kalite iyi | **2.000** |
| Sonraki seviyeler | Kalite yüksek kaldıkça otomatik yükselir | 10.000 → 100.000 → sınırsız |

- Saniyede gönderim (throughput): numara başına varsayılan ~80 mesaj/sn. Coexistence modunda ~20 mesaj/sn. Bir salon için fazlasıyla yeterli.
- **Kalite puanı:** Müşteriler mesajları engeller ya da şikâyet ederse puan düşer, limit küçülür, numara kısıtlanabilir. Bu yüzden kampanyalar **sadece izin veren müşterilere** ve **düşük sıklıkta** gönderilmeli. Meta kullanıcı başına pazarlama mesajı sayısını kendi tarafında da sınırlıyor.
- Şablonlar Meta onayından geçer. Onay genelde birkaç dakika ile 24 saat arasında gelir. 24 saat penceresi dışında **yalnızca onaylı şablonla** mesaj atılabilir.

**Örnek salon (ayda 600 randevu, 1.500 kayıtlı müşteri) için aylık WhatsApp maliyeti:**

| Kalem | Adet | Tahmini maliyet |
|---|---|---|
| Müşteri soruları ve yanıtlar (servis) | sınırsız | 0 $ |
| Randevu onayı (çoğu 24 saat penceresi içinde) | 600 | ~0-1 $ |
| 24 saat önce hatırlatma | 600 | ~3 $ |
| Google yorum isteği | 600 | ~3-6 $ |
| Tekrar işlem ve yan ürün önerisi | 400 | ~4 $ |
| Aylık 2 kampanya × 800 izinli müşteri | 1.600 | ~16 $ |
| **Toplam** | | **~25-30 $ / ay** (kampanya sayısına göre değişir) |

### 3.2 Instagram Mesajlaşma API'si (Meta)

- **Ücret yok.** Instagram DM API'si ücretsizdir.
- **Kurallar:**
  - Sadece **profesyonel hesap** (İşletme ya da İçerik Üreticisi) bağlanabilir.
  - Müşteri son 24 saat içinde yazdıysa serbest yanıt verilir. İnsan çalışan "HUMAN_AGENT" etiketiyle bu süreyi **7 güne** uzatabilir.
  - **Müşteriye ilk mesajı siz atamazsınız.** Instagram'dan toplu kampanya gönderilemez. Kampanyalar WhatsApp'tan yapılır.
  - Yorumlara "özel yanıt" (private reply) ile tek bir DM gönderilebilir. Bu, "fiyat?" yorumlarına DM ile cevap vermek için kullanışlıdır.
- **Hız limitleri:** Hesap başına saniyede onlarca mesaj civarındadır. Ayrıca Graph API'nin genel saatlik çağrı limitleri vardır. Bir salonun trafiği bu limitlere yaklaşmaz.

### 3.3 Claude API (Anthropic) — Yapay Zekâ

| Model | Girdi / 1M token | Çıktı / 1M token | Önbellekten okuma | Not |
|---|---|---|---|---|
| **Claude Opus 5.5** | 4 $ | 20 $ | 0,20 $ | En yetenekli seçenek. Varsayılan öneri. |
| Claude Sonnet 5.5 | 2 $ | 10 $ | 0,10 $ | Hızlı ve dengeli |
| Claude Haiku 5.5 | 0,10 $ | 0,50 $ | — | Çok ucuz. Basit SSS ve sınıflandırma için. |

**Bir sohbet ne kadar tutar? (tahmini)**
- Salon bilgi bankası + sistem istemi ≈ 4.000 token. Önbellekten okunur ve neredeyse bedavaya gelir.
- Mesaj başına ≈ 1.000 yeni girdi token'ı + 300-800 çıktı ve düşünme token'ı.
- Ortalama bir randevu sohbeti 5-6 mesajdır.

| Model | Mesaj başına | Sohbet başına | Ayda 500 sohbet (orta salon) |
|---|---|---|---|
| Opus 5.5 | ~0,015-0,02 $ | ~0,10 $ | **~50 $** |
| Sonnet 5.5 | ~0,008 $ | ~0,05 $ | **~25 $** |
| Haiku 5.5 | ~0,0005 $ | ~0,003 $ | **~1,5 $** |

> Model seçimi sizin kararınız. Önerim: kalite için Opus 5.5 ile başlayın, ilk 1-2 ayın gerçek konuşmalarıyla ölçün. Kalite yeterli kalıyorsa sınıflandırma ve SSS gibi basit işleri daha ucuz modele taşıyın. Rakamlar tahmindir. Gerçek değerler `ai_usage` tablosundan izlenecek.

**Claude API limitleri:**
- Hesap "kullanım katmanı"na (usage tier) göre dakikadaki istek ve token limitleri vardır. Hesaba yükleme yapıldıkça katman otomatik yükselir. Güncel limitler Console → Limits sayfasında görünür.
- 50 salona kadar düşük katmanlar bile yeter. Bir salonun yoğun saatinde dakikada birkaç istek olur.
- **Console'dan aylık harcama limiti (spend limit) koyun.** Ayrıca sistemde **salon başına aylık AI bütçesi** tutulmalı. Bütçe aşılırsa asistan "ekibimiz size dönecek" moduna geçer ve sahibe bildirim gider.

### 3.4 Diğer Servisler

| Servis | Kullanım | Aylık maliyet |
|---|---|---|
| Google yorum bağlantısı | `https://search.google.com/local/writereview?placeid=<PLACE_ID>`. **API gerekmez.** | 0 $ |
| Google Places API (opsiyonel) | Panelde salonu arayıp Place ID bulmak | Ücretsiz kota içinde kalır |
| Google Business Profile API (opsiyonel, faz 4) | Yorumları panelde görmek ve AI ile yanıt taslağı hazırlamak. **Erişim başvurusu gerekir.** Varsayılan kota ~300 istek/dk. | 0 $ |
| Vercel Pro | Dakikalık cron, daha uzun fonksiyon süresi | ~20 $ / üye |
| Neon Postgres | Mevcut | 0-19 $ |
| Kuyruk servisi (QStash/Inngest) | Gecikmeli işler, tekrar deneme | Ücretsiz katman → ~10 $ |
| Resend | E-posta | Ücretsiz katman |

### 3.5 Salon Başına Toplam Maliyet ve Fiyatlandırma Önerisi

| Kalem | Orta salon (aylık) |
|---|---|
| WhatsApp (Meta) | ~25-30 $ |
| Claude (Opus 5.5) | ~50 $ (Haiku 5.5 ile ~2 $) |
| Altyapı payı (50 salona bölünmüş) | ~1-2 $ |
| **Toplam** | **~55-80 $** (≈ 2.300-3.400 TL) |

**Paket önerisi:**
- **Başlangıç:** Asistan + randevu + hatırlatma. Aylık mesaj ve AI kotası var.
- **Pro:** Tüm otomasyonlar + kampanya + Instagram + web sitesi.
- **WhatsApp ücretlerini kimin ödeyeceği:**
  - (a) Salon kendi kartını Meta'ya tanımlar ve doğrudan öder. Sizin için en az riskli seçenek budur ve **önerilen** de budur.
  - (b) Siz ödersiniz ve pakete gömersiniz. Bunun için Meta "Solution Partner" kredi hattı ya da bir BSP gerekir.

---

## 4. Uzaktan Kurulum — Müşterinin WhatsApp ve Instagram'ını Nasıl Bağlarız?

### 4.0 Bizim tarafımızda **bir kere** yapılacaklar (ön koşul, 2-6 hafta sürebilir — HEMEN başlanmalı)

1. **Meta Business Portfolio** açılır (Basbay Studio adına) ve **işletme doğrulaması** yapılır. Vergi levhası, ticaret sicil, alan adı ve telefon gerekir.
2. **Meta Developer** hesabında bir uygulama oluşturulur. Eklenecek ürünler: WhatsApp, Instagram (Instagram Login ile), Webhooks.
3. Uygulama **"Tech Provider"** olarak kaydedilir. Böylece salonlar kendi hesaplarını bizim panelimizden tek tıkla bağlayabilir (**Embedded Signup**).
4. **App Review (uygulama incelemesi)** için başvurulur. Gerekli izinler:
   - WhatsApp: `whatsapp_business_management`, `whatsapp_business_messaging`
   - Instagram: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`
   - Her izin için ekran kaydı videosu, gizlilik politikası URL'si, veri silme URL'si ve kullanım açıklaması istenir.
5. Webhook adresi tanımlanır: `https://dijitalberber.com/api/webhooks/meta`. Doğrulama token'ı ve App Secret ile imza kontrolü yapılır.
6. **Anthropic Console:** organizasyon, API anahtarı, harcama limiti.
7. Hukuki metinler hazırlanır (bkz. Bölüm 6): KVKK aydınlatma metni, açık rıza, yurt dışına aktarım ve ticari ileti izni.

> **Alternatif kısa yol:** Tech Provider onayı beklenirken 360dialog, Twilio ya da Gupshup gibi resmi bir **BSP (çözüm ortağı)** üzerinden başlanabilir. Onlar da Embedded Signup sunar. Dezavantajı mesaj başına ya da aylık ek ücret almalarıdır. Uzun vadede doğrudan Cloud API daha ucuzdur.

### 4.1 Salonu bağlama — WhatsApp (salon başına ~15-20 dakika, uzaktan)

Salon sahibiyle Google Meet ya da WhatsApp görüntülü görüşme açılır, ekran paylaşılır. Alternatif olarak salon panelde adım adım sihirbazı kendisi izler.

**Hangi numara kullanılacak? 3 seçenek:**

| Seçenek | Açıklama | Ne zaman |
|---|---|---|
| **A) Coexistence (birlikte kullanım)** — *önerilen* | Salonun **mevcut WhatsApp Business uygulamasındaki numarası** API'ye bağlanır. Salon telefondaki uygulamayı kullanmaya devam eder. Son 6 aya kadar sohbet geçmişi ve kişiler aktarılabilir. | Salon, müşterilerinin bildiği numarayı değiştirmek istemiyorsa |
| B) Yeni numara | Salon için yeni bir hat alınır, sadece API'de kullanılır | Temiz başlangıç isteniyorsa |
| C) Taşıma | Numara Business App'ten silinir, tamamen API'ye geçer. Telefonda uygulama artık çalışmaz. | Coexistence uygun değilse |

> Coexistence'ın bazı kısıtları var: daha düşük gönderim hızı, bazı özelliklerde farklılık, telefondaki uygulamanın en az 14 günde bir açılması gerekliliği. Güncel kısıtlar kurulumdan önce kontrol edilmeli.

**Adımlar:**
1. Salon sahibi **Dijital Berber paneline** girer → *Ayarlar → Kanallar → "WhatsApp'ı Bağla"*.
2. Meta'nın açılır penceresi (Embedded Signup) gelir. Sahip **kendi Facebook hesabıyla** giriş yapar.
3. Bir işletme portföyü seçer ya da yeni oluşturur. Salon adı, web sitesi ve adres girilir.
4. Bir **WhatsApp Business hesabı (WABA)** oluşturulur. Görünen ad girilir (örn. "Lara Güzellik Salonu").
5. Numara seçilir. Coexistence seçildiyse telefondaki WhatsApp Business uygulamasında çıkan QR kod ya da onay ekranı onaylanır. Yeni numara seçildiyse SMS/arama ile gelen kod girilir.
6. Pencere kapanınca bizim sistemimiz şunları alır: `waba_id`, `phone_number_id` ve bir kod. Bu kod sunucuda kalıcı erişim token'ına çevrilir ve **şifrelenerek** saklanır. Ardından sistem:
   - numarayı Cloud API'ye kaydeder (register),
   - WABA'yı uygulamamızın webhook'una abone eder (subscribed_apps),
   - **standart şablonları otomatik oluşturup** Meta onayına gönderir (randevu_onay, randevu_hatirlatma, randevu_iptal, google_yorum, tekrar_islem_hatirlatma, kampanya_genel).
7. Salon sahibi **WhatsApp Manager → Ödeme yöntemleri** bölümüne kredi kartını ekler. Bu, şablon mesaj ücretleri için gereklidir.
8. (Önerilir) Salon kendi Meta işletme doğrulamasını da yapar. Böylece limit 250'den 2.000'e çıkar ve görünen ad onaylanır.
9. Test: Salon sahibinin telefonundan numaraya "Merhaba" yazılır, asistan yanıt verir, deneme randevusu açılıp iptal edilir.

### 4.2 Salonu bağlama — Instagram (~5-10 dakika)

1. Instagram hesabı **Profesyonel hesap** olmalı. Değilse: *Ayarlar → Hesap türü ve araçlar → Profesyonel hesaba geç → İşletme*.
2. Instagram uygulamasında: *Ayarlar → Mesajlar ve hikâye yanıtları → Mesaj kontrolleri → Bağlı araçlar → "Mesajlara erişime izin ver"* **açılır**. Bu açılmazsa API mesajları okuyamaz.
3. Panelde *Kanallar → "Instagram'ı Bağla"* tıklanır. Instagram ile giriş yapılır ve izinler onaylanır.
4. Sistem `ig_user_id`'yi ve uzun süreli token'ı kaydeder (yaklaşık 60 gün geçerli, otomatik yenilenir), webhook aboneliğini açar (messages, comments).
5. Test: Başka bir hesaptan DM atılır, panel gelen kutusunda görünür, asistan yanıt verir.

### 4.3 Salonu bağlama — Google yorum

1. Panelde *Ayarlar → Google* bölümünde salon adı aranır (Places API) **ya da** Google Haritalar bağlantısı yapıştırılır.
2. Sistem Place ID'yi bulur ve yorum bağlantısını oluşturur.
3. Test bağlantısı açılarak doğru salona gidip gitmediği kontrol edilir.

### 4.4 Salon verilerinin içeri alınması

1. Hizmetler, süreler, fiyatlar ve çalışanlar panelden girilir. Excel ile toplu içe aktarma da yapılabilir.
2. Mevcut müşteri listesi (telefon, isim) içe aktarılır. **Pazarlama izni olmayanlara kampanya gitmez.** İzin durumu ayrıca işaretlenir.
3. Bilgi bankası doldurulur: adres, otopark, ödeme yöntemleri, iptal politikası, sık sorulan sorular, asistanın üslubu.
4. Otomasyonlar açılır ve süreleri ayarlanır: hatırlatma kaç saat önce gidecek, yorum isteği kaç saat sonra gidecek vb.
5. **1 hafta "gölge mod" önerilir:** Asistan yanıtları otomatik göndermez, panelde **taslak** olarak önerir. Çalışan onaylar. Kalite görüldükten sonra tam otomatiğe geçilir.

---

## 5. Yol Haritası (Fazlar)

| Faz | Süre | İçerik |
|---|---|---|
| **0 — Hazırlık** | 1. hafta (paralel, 2-6 hafta sürebilir) | Meta işletme doğrulaması, uygulama, Tech Provider, App Review başvurusu. Anthropic hesabı. Hukuki metinler. |
| **1 — WhatsApp çekirdeği** | 2-4. hafta | Webhook, kanal bağlama (Embedded Signup), mesaj tabloları, panel gelen kutusu, insan devri, Claude asistanı (SSS + randevu araçları), şablon yönetimi |
| **2 — Otomasyonlar** | 5-6. hafta | Kuyruk ve zamanlayıcı, randevu onayı ve hatırlatma (butonlu), Google yorum isteği, tekrar işlem hatırlatması, yan ürün önerisi |
| **3 — Pazarlama** | 7-8. hafta | İzin (opt-in) yönetimi, segmentler, kampanyalar, kuponlar ve özel indirimler, boş randevu doldurma ve bekleme listesi, raporlar (dönüşüm, gelir) |
| **4 — Instagram + web sitesi** | 9-10. hafta | Instagram DM ve yorum entegrasyonu, salon mini web sitesi, (opsiyonel) Google Business Profile yorum yanıtlama |
| **5 — Pilot** | 11-12. hafta | 2-3 pilot salon, gölge mod, istem (prompt) iyileştirme, maliyet ölçümü, fiyat paketlerinin netleşmesi |

**Mevcut koddan yeniden kullanılacaklar:** `booking` (randevu oluşturma ve durum makinesi), müsaitlik motoru, `business` (çalışma saatleri, çalışanlar), `customer`, `reviews`, `billing` (salon aboneliği), `notifications` (şablon altyapısı), günlük cron. İşletme türüne **"güzellik salonu"** eklenir. Hizmet türleri genişletilir (cilt bakımı, lazer, protez tırnak, kirpik, kaş vb.).

---

## 6. Hukuk ve Uyum (Türkiye) — Atlanmaması Gerekenler

- **6563 sayılı Kanun / Ticari Elektronik İleti:** Kampanya, indirim ve yan ürün önerisi gibi **ticari** mesajlar için müşterinin **önceden onayı** gerekir. Her mesajda ret (çıkış) imkânı olmalıdır: "Mesaj almak istemiyorsanız DUR yazın". Onay kaydı saklanmalıdır. **İYS (İleti Yönetim Sistemi)** yükümlülüğü salon ve kanal bazında hukukçuyla netleştirilmelidir. Randevu hatırlatması gibi hizmet mesajları genelde ticari ileti sayılmaz.
- **KVKK:**
  - Aydınlatma metni hazırlanmalı. Pazarlama için açık rıza alınmalı.
  - Mesajlar Meta ve Anthropic (ABD) sunucularında işlenir. Bu **yurt dışına aktarım** demektir. Standart sözleşme kullanılmalı ve KVKK'ya bildirim yapılmalıdır (2024 değişikliği).
  - Salon veri sorumlusu, Dijital Berber veri işleyen olur. Aralarında **veri işleme sözleşmesi** imzalanmalıdır.
  - Sağlık verisi sayılabilecek bilgiler (alerji, cilt hastalığı vb.) için ekstra dikkat gerekir. Asistan bu bilgileri istememeli.
- **Google yorum politikası:** Yorum isteği **herkese** gönderilmelidir. "Memnun musunuz? Evet ise Google'a, hayır ise bize yazın" gibi filtreleme (review gating) Google kurallarına aykırıdır ve yorumların silinmesine yol açabilir. Yorum karşılığında indirim de verilemez.
- **Meta Ticaret Politikası:** Bazı ürün ve hizmet kategorileri kısıtlıdır. Kozmetik genelde sorun değildir. Bazı tıbbi ve estetik işlemler kısıtlı olabilir, kontrol edilmelidir.
- **Asistan şeffaflığı:** İlk mesajda müşteriye bir yapay zekâ asistanıyla konuştuğu söylenmeli. Her zaman insana bağlanma seçeneği sunulmalı.

---

## 7. Riskler ve Önlemler

| Risk | Önlem |
|---|---|
| App Review / Tech Provider onayı gecikir | Faz 0'a hemen başlanır. Bu sürede BSP (360dialog vb.) ile pilot yapılır. |
| Numara kalitesi düşer, numara kısıtlanır | Sadece izinli müşteriye kampanya, sıklık sınırı (örn. ayda en fazla 2), kolay çıkış, kalite puanı panelde izlenir |
| Asistan yanlış fiyat ya da saat söyler | Fiyat ve saat yalnızca araçlardan (DB) gelir. Asistan uydurmaz. Gölge mod. Konuşma kayıtları incelenir. |
| AI maliyeti kontrolden çıkar | Salon başına aylık bütçe, önbellekleme, mesaj başına token sınırı, `ai_usage` raporu |
| Token sızıntısı | Token'lar DB'de şifreli tutulur (uygulama anahtarıyla AES-GCM). Webhook imzası doğrulanır. Salonlar birbirinin verisine erişemez (tenant izolasyonu). |
| Meta API değişiklikleri | Graph API sürümü sabitlenir. Yılda 1-2 kez sürüm yükseltme planlanır. |

---

## 8. Karar Bekleyen Konular

1. **AI modeli:** Opus 5.5 (en iyi kalite, ~50 $/salon/ay) mi, yoksa ölçüm sonrası daha ucuz model mi?
2. **WhatsApp ücretleri:** Salon kendi kartıyla mı ödeyecek (önerilen), yoksa pakete mi gömülecek?
3. **Doğrudan Tech Provider mı, yoksa başlangıçta BSP mi?**
4. **Kuyruk ve zamanlayıcı servisi:** Vercel Queues, QStash ya da Inngest?
5. **Paket fiyatları:** Pilot maliyet ölçümünden sonra belirlenecek.
