# Güzellik Salonu Yapay Zekâ Asistanı — Basit Anlatımlı Plan

> Kasım 2026 · Bu proje **Dijital Berber'den ayrı**, sıfırdan yeni bir üründür. Kendi alan adı, kendi kodu ve kendi veritabanı olacak.
> Aşağıda "senindomain.com" yazan her yere alacağınız alan adını koyun.
> Rakamlar yaklaşıktır. Meta ve Google fiyatları değişebilir, canlıya çıkmadan önce kontrol edin.

---

## 1. Sistem tek cümlede

Salonun müşterisi WhatsApp'tan ya da Instagram'dan yazar. Yazılan mesaj bizim sunucumuza gelir. Claude (yapay zekâ) mesajı okur, salonun takvimine bakar, cevabı yazar ve randevuyu açar. Salon sahibi her şeyi kendine ait panelde (`salonadi.senindomain.com`) görür.

---

## 2. Web paneli: subdomain düzeni

### Adresler

| Adres | Kimin için | Ne var |
|---|---|---|
| `senindomain.com` | Herkes | Sizin tanıtım ve satış siteniz |
| `admin.senindomain.com` | **Sadece siz** | Bütün salonlar, abonelikler, maliyetler, yeni salon açma |
| `lara.senindomain.com` | Lara Güzellik'in sahibi ve çalışanları | Lara'nın yönetim paneli |
| `mina.senindomain.com` | Mina Beauty'nin sahibi ve çalışanları | Mina'nın yönetim paneli |
| `api.senindomain.com` | Meta (WhatsApp/Instagram) | Mesajların geldiği kapı, insanlar görmez |

### "Her müşterinin ayrı paneli" ne demek?

**Apartman benzetmesi:** Tek bir bina var (tek uygulama, tek veritabanı). Her salon bir daire. Her dairenin kapısında kendi adı (subdomain) ve kendi anahtarı (kullanıcı adı ve şifre) var. Lara, Mina'nın dairesine giremez.

- Her salona **ayrı sunucu kurulmaz.** 100 salon olunca 100 sunucu güncellemek kâbus olur, fatura da patlar.
- Sistem adres çubuğundaki ilk kelimeye bakar (`lara`), "bu Lara Güzellik" der ve **yalnızca Lara'nın verisini** gösterir.
- Veritabanında her kayıtta bir `salon_id` sütunu bulunur: müşteri, randevu, mesaj, çalışan, kampanya. Her sorgu bu sütuna göre filtrelenir. Bu kural kodda tek bir yerde zorunlu tutulur, unutulamaz.
- Yeni bir özellik eklediğinizde **bütün salonlara aynı anda gelir.**
- İsteyen salon kendi alan adını da kullanabilir, örneğin `panel.laraguzellik.com`. Salon kendi alan adında bir CNAME kaydı açar, o kadar.

### Bunun için teknik olarak ne lazım?

1. **Alan adı alın.** Namecheap, GoDaddy ya da isimtescil olur.
2. **DNS'e joker kayıt (wildcard) ekleyin:** `*.senindomain.com` → sunucu. Bu sayede her yeni salon için DNS'e dokunmanız gerekmez. `lara.`, `mina.`, `herhangi.` hepsi otomatik çalışır.
3. **SSL (kilit ikonu) da joker olmalı.** Vercel'de alan adının nameserver'ları Vercel'e yönlendirilirse joker SSL otomatik verilir.
4. **Uygulamada bir "middleware" olur.** Gelen isteğin subdomain'ini okur, salonu bulur, kullanıcının o salona ait olup olmadığını kontrol eder.
5. **Oturum çerezi her subdomain'e ayrı yazılır.** Böylece Lara'nın oturumu Mina'nın adresinde geçerli olmaz.

### Panelde olacak menüler

- **Gelen Kutusu:** WhatsApp ve Instagram konuşmalarının hepsi. Asistanın yazdıkları görünür. Çalışan "Ben devralıyorum" diyerek konuşmaya girebilir.
- **Takvim:** Çalışan sütunlu gün/hafta görünümü. Randevular sürükle-bırak ile taşınır.
- **Müşteriler:** Geçmiş işlemler, harcama, notlar, kampanya izni var mı yok mu.
- **Hizmetler ve Ürünler:** Fiyat, süre, "kaç günde bir tekrar edilir", "yanında hangi ürün önerilir".
- **Çalışanlar:** Vardiya, izin, hangi hizmetleri yaptığı, prim raporu, panel yetkisi (sahip / yönetici / çalışan).
- **Otomasyonlar:** Hatırlatma, Google yorum, tekrar işlem, yan ürün. Her biri açma/kapama düğmesi ve saat ayarıyla.
- **Kampanyalar ve Kuponlar:** Müşteri grubu seç, mesajı seç, gönder. Kişiye özel indirim tanımla.
- **Asistan Ayarları:** Salon bilgileri, sık sorulan sorular, konuşma üslubu ("siz" mi "sen" mi, emoji olsun mu).
- **Kanallar:** "WhatsApp'ı Bağla", "Instagram'ı Bağla", Google yorum bağlantısı.
- **Raporlar:** Kaç randevuyu asistan aldı, iptal oranı, kampanya dönüşleri, bu ayki AI ve WhatsApp harcaması.
- **Web Sitesi:** Salonun herkese açık sayfası (aşağıya bakın).

### Salonun web sitesi (+++)

- `lara.senindomain.com` adresine panel girişi olmayan biri gelirse **salonun tanıtım sitesini** görür: hizmetler, fotoğraflar, "Randevu Al" butonu.
- Panel `lara.senindomain.com/panel` adresinde durur.
- Salon isterse kendi alan adını (`laraguzellik.com`) siteye bağlar.

---

## 3. Bir mesajın yolculuğu (en basit hali)

```
1. Ayşe Hanım, Lara Güzellik'in WhatsApp'ına yazar: "Yarın kaşa yer var mı?"
2. Meta bu mesajı api.senindomain.com/webhooks/meta adresine yollar.
3. Sistem mesajdaki numaradan "Bu Lara'nın numarası" der, mesajı Lara'nın kutusuna kaydeder.
4. Claude'a sorulur. Claude şunu bilir:
   - Lara'nın hizmetleri, fiyatları, kuralları
   - Ayşe Hanım'ın geçmişi
   - Kullanabileceği araçlar: "müsait saat bul", "randevu aç", "iptal et", "insana devret"
5. Claude "müsait saat bul" aracını çağırır. Sistem takvime bakar: 11:00 ve 15:30 boş.
6. Claude cevap yazar: "Yarın 11:00 veya 15:30 uygun, hangisini ayıralım?"
7. Ayşe "15:30" der → Claude "randevu aç" aracını çağırır → takvime düşer.
8. Ertesi gün 13:30'da sistem otomatik hatırlatma yollar: [Geliyorum] [İptal]
9. İşlem bitince 2 saat sonra Google yorum bağlantısı gider.
10. 4 hafta sonra "Kaş zamanınız geldi, randevu ayıralım mı?" mesajı gider.
```

**Kural:** Claude saat ya da fiyat **uydurmaz.** Bu bilgileri her zaman araçla veritabanından alır.

---

## 4A. DÜŞÜK MALİYET HEDEFİ — salon başına ayda 50-100 giden mesaj

**Varsayım:** Bir salon ayda **50-100 mesajı ilk kendisi gönderir** (hatırlatma, yorum isteği, kampanya). Bunun dışında müşterilerin yazdığı mesajlara cevap verilir.

| Kalem | Hesap | Aylık |
|---|---|---|
| WhatsApp giden mesaj (çoğu utility) | 100 × ~0,005 $ | **~0,5 $** |
| İçlerinde kampanya olursa (en kötü durum, hepsi marketing) | 100 × ~0,01 $ | ~1 $ |
| Müşteriye verilen cevaplar | Bedava | 0 $ |
| Instagram | Bedava | 0 $ |
| Claude Haiku 5.5, ayda ~200 sohbet | 200 × ~0,003 $ | **~0,6 $** |
| (Aynı hacim Opus 5.5 ile olursa) | 200 × ~0,10 $ | ~20 $ |
| Sunucu ve veritabanı payı | ~10 $ / salon sayısı | 20 salonda ~0,5 $ |
| **Toplam (Haiku ile)** | | **≈ 1,5-2 $ / salon / ay (≈ 60-80 TL)** |

### Maliyeti düşük tutmanın 8 kuralı

1. **Ucuz model.** Asistanı Claude Haiku 5.5 ile çalıştırın. Zor durumlar (şikâyet, karmaşık randevu değişikliği) zaten "insana devret" ile çalışana gider.
2. **Bedava pencereyi kullanın.** Müşteri son 24 saat içinde yazdıysa o pencerede gönderilen her mesaj, şablonlu mesajlar dahil, **bedavadır.** Randevu onayı müşteri yazarken verilir, ücret çıkmaz.
3. **Hatırlatmayı "utility" kategorisinde tutun.** Utility mesaj, marketing mesajın yaklaşık yarı fiyatıdır. Hatırlatma ve onay mesajlarının içine **kampanya ya da indirim yazmayın.** Yazarsanız Meta mesajı marketing sayar.
4. **Tek mesajda birleştirin.** "Hatırlatma + Geliyorum/İptal butonu" tek mesaj olsun. Ayrı ayrı "onay", "hatırlatma 1", "hatırlatma 2" göndermeyin. Randevu başına 1 hatırlatma yeter.
5. **Google yorum isteğini hatırlatmaya bağlayın.** Müşteri butona bastığında 24 saat penceresi açılır. İşlemden sonraki teşekkür ve yorum mesajı bu pencereye denk gelirse bedava olur.
6. **Salon başına aylık kota koyun.** Örneğin 100 giden mesaj ve 300 AI sohbeti. Kota dolunca panelde uyarı çıkar. İsteyen salon ek paket alır.
7. **Önbellek (prompt caching) kullanın.** Salon bilgileri her mesajda tekrar okunmaz, önbellekten okunur ve neredeyse bedava olur.
8. **Ucuz altyapı seçin:**
   - **Seçenek A (önerilen başlangıç):** Hetzner VPS (~5-8 €/ay) üzerinde Coolify ile uygulama + PostgreSQL. DNS ve joker SSL için Cloudflare (bedava). Bütün salonlar için toplam **~8 €/ay**.
   - **Seçenek B:** Vercel Pro (20 $) + Neon (0-19 $). Daha az uğraş, daha pahalı.
   - Zamanlanmış işleri (hatırlatmalar) VPS'te basit bir cron ve kuyrukla çalıştırın. Ek servise para vermeyin.

---

## 4. Ne kadar tutar? (büyük salon örneği, ayda ~600 randevu — referans)

### WhatsApp (parayı Meta alır)

- **Müşteri yazarsa:** 24 saat içinde ne kadar cevap verirseniz verin **bedava.**
- **Siz ilk yazarsanız** (hatırlatma, kampanya) para öder ve önceden onaylı bir "şablon" kullanırsınız:
  - Hatırlatma ve randevu mesajı: ~0,005 $ (yaklaşık 20 kuruş)
  - Kampanya ve öneri mesajı: ~0,01 $ (yaklaşık 40 kuruş)
- **Günlük sınır:**
  - Yeni hesap günde **250 farklı kişiye** ilk mesajı atabilir.
  - Meta işletme doğrulaması yapılınca bu sınır **2.000** olur. Sonra 10 bin, 100 bin, sınırsız diye büyür.
  - Gelen mesajlara cevaplar bu sınıra dahil değildir.
- Müşteriler sizi engellerse ya da şikâyet ederse "kalite puanı" düşer, sınır küçülür. **Kampanyayı sadece izin verenlere, ayda en fazla 1-2 kez atın.**
- **Toplam:** ayda ~25-30 $

### Instagram

- **Tamamen bedava.**
- **Ama müşteriye ilk siz yazamazsınız.** Sadece size yazan kişiye 24 saat içinde cevap verebilirsiniz. Elle cevap veren çalışan için bu süre 7 gün.
- Kampanya gönderimi Instagram'dan yapılamaz, WhatsApp'tan yapılır.

### Claude (yapay zekâ, parayı Anthropic alır)

| Model | Bir sohbet (5-6 mesaj) | Ayda 500 sohbet |
|---|---|---|
| Claude Opus 5.5 (en akıllı) | ~0,10 $ | **~50 $** |
| Claude Sonnet 5.5 | ~0,05 $ | ~25 $ |
| Claude Haiku 5.5 (en ucuz) | ~0,003 $ | ~1,5 $ |

- Anthropic Console'da **aylık harcama sınırı** koyun. Ayrıca her salona kendi aylık AI bütçesini tanımlayın. Bütçe biterse asistan "Ekibimiz size dönecek" der ve sahibe haber verir.
- Dakikalık istek sınırları hesabın kullanım seviyesine göre otomatik artar. Onlarca salon için sorun olmaz.

### Google yorum

- **Bedava, API bile gerekmez.** Salonun Place ID'si ile bir bağlantı oluşturulur: `https://search.google.com/local/writereview?placeid=XXXX`

### Sizin sabit giderleriniz (bütün salonlar için toplam)

| Kalem | Aylık |
|---|---|
| Alan adı | ~1 $ (yıllık ~12 $) |
| Vercel Pro (hosting) | ~20 $ |
| Neon (veritabanı) | 0-19 $ |
| Zamanlanmış işler / kuyruk (QStash veya Inngest) | 0-10 $ |
| E-posta (Resend) | 0 $ |

**Salon başına toplam maliyet:** ~55-80 $/ay (Opus ile). Ucuz modelle ~30 $. Satış fiyatınızı bunun üstüne kurun.

---

## 5. Hesaplar: bir kere sizin açacaklarınız

Bunlara **bu hafta başlayın.** Meta onayları 2-6 hafta sürebilir.

| # | Ne | Nereden | Neden |
|---|---|---|---|
| 1 | Alan adı | Namecheap / GoDaddy / isimtescil | Paneller burada çalışacak |
| 2 | Meta Business Portfolio + **işletme doğrulaması** | business.facebook.com | Şirketinizin gerçek olduğunu Meta'ya kanıtlar. Vergi levhası ve faaliyet belgesi istenir. |
| 3 | Meta Developer uygulaması | developers.facebook.com | WhatsApp ve Instagram'a bağlanan "fiş" |
| 4 | **Tech Provider** kaydı | Aynı yer | Salonların tek tıkla hesabını size bağlayabilmesi için |
| 5 | **App Review** (uygulama incelemesi) | Aynı yer | Meta, mesaj okuma/gönderme iznini inceleyip verir. Ekran kaydı videosu, gizlilik politikası sayfası ve veri silme sayfası istenir. |
| 6 | Anthropic Console | platform.claude.com | Claude API anahtarı. Harcama sınırını burada koyarsınız. |
| 7 | Vercel + Neon + GitHub (yeni repo) | vercel.com, neon.tech, github.com | Kodun ve verinin yaşadığı yer |
| 8 | Avukat / KVKK danışmanı | — | Aydınlatma metni, kampanya izni, yurt dışına veri aktarımı |

> **Meta onayı gecikirse:** 360dialog ya da Twilio gibi Meta'nın resmi çözüm ortaklarından biriyle hemen başlanabilir. Ek ücret alırlar ama beklemezsiniz.

---

## 6. Yeni bir salonu uzaktan kurmak (adım adım)

**Hazırlık:** Salon sahibiyle WhatsApp görüntülü görüşme ya da Google Meet açın, ekranını paylaşsın. Yanında **telefonu, Facebook şifresi, Instagram şifresi ve kredi kartı** olsun. Toplam ~30 dakika.

### Adım 1 — Salonu açın (siz, 2 dk)

`admin.senindomain.com` → "Yeni Salon" → ad: *Lara Güzellik*, adres: `lara`, sahibin e-postası.
Sahibe otomatik bir e-posta gider: "Şifreni belirle". Artık `lara.senindomain.com` adresi çalışıyor.

### Adım 2 — WhatsApp'ı bağlayın (salon sahibi, 10 dk)

1. Sahip `lara.senindomain.com/panel` adresine girer → **Kanallar → "WhatsApp'ı Bağla"**
2. Meta'nın küçük penceresi açılır. Sahip **kendi Facebook hesabıyla** giriş yapar.
3. "İşletme seç / oluştur" ekranında salon adını, web sitesini ve adresini yazar.
4. **Numara seçimi** gelir. Burada üç yol var:
   - **(Önerilen) Mevcut WhatsApp Business numarası:** Salonun bilinen numarası aynen kalır. Telefondaki WhatsApp Business uygulamasında çıkan onay ekranı onaylanır. Salon telefondan da yazmaya devam edebilir.
   - **Yeni numara:** SMS ile gelen 6 haneli kod girilir.
   - **Normal (Business olmayan) WhatsApp kullanıyorsa:** Önce telefona WhatsApp Business uygulaması kurulur ve numara oraya taşınır. Sonra birinci yol uygulanır.
5. Pencere kapanır, panelde "✅ WhatsApp bağlandı" yazar. Sistem arka planda şunları kendiliğinden yapar:
   - mesajları dinlemeye başlar,
   - hatırlatma, randevu onayı, Google yorum ve kampanya **şablonlarını** Meta'ya onaya gönderir. Onay birkaç dakika ile 1 gün arasında gelir.
6. **Kart ekleme:** Sahip business.facebook.com → WhatsApp Manager → **Ödeme yöntemi** bölümüne kredi kartını ekler. WhatsApp ücretleri doğrudan bu karttan çekilir, size yansımaz.
7. **Test:** Sahibin kendi telefonundan salon numarasına "Merhaba" yazılır, asistan cevap vermeli.

### Adım 3 — Instagram'ı bağlayın (salon sahibi, 5 dk)

1. Telefonda Instagram → **Ayarlar → Hesap türü → Profesyonel hesaba geç → İşletme** (zaten profesyonelse bu adım atlanır).
2. Instagram → **Ayarlar → Mesajlar → Bağlı araçlar → "Mesajlara erişime izin ver" → AÇ.** *(Bu yapılmazsa hiçbir şey çalışmaz!)*
3. Panel → **Kanallar → "Instagram'ı Bağla"** → Instagram şifresiyle giriş → "İzin ver".
4. **Test:** Başka bir hesaptan DM atılır, panelin Gelen Kutusu'na düşmeli.

### Adım 4 — Google yorumu bağlayın (1 dk)

Panel → **Kanallar → Google** → salon adını arayın ya da Google Haritalar bağlantısını yapıştırın → "Kaydet". Test bağlantısına tıklayıp doğru salonun açıldığını kontrol edin.

### Adım 5 — Salon bilgilerini girin (siz ya da sahip, 15 dk)

- Hizmetler, süreler, fiyatlar (Excel'den toplu yükleme de olur)
- Çalışanlar ve çalışma saatleri
- Müşteri listesi (Excel / rehber). **Kampanya izni olmayanları işaretleyin.**
- Asistan bilgileri: adres, otopark, ödeme yöntemleri, iptal kuralı, sık sorulan sorular
- Otomasyonları açın: hatırlatma (24 saat önce), Google yorum (2 saat sonra), tekrar işlem

### Adım 6 — İlk hafta "çıraklık modu"

Asistan cevapları **kendisi göndermez**, panelde taslak olarak hazırlar. Çalışan "Gönder" der ya da düzeltir. Bir hafta sonra her şey iyiyse **otomatik mod** açılır.

---

## 7. Kesinlikle yapılmaması gerekenler

1. **İzin almadan kampanya atmak.** Hem kanuna aykırıdır (6563 sayılı Kanun, İYS) hem de Meta numarayı kısıtlar. Her kampanya mesajının altında "Almak istemiyorsanız DUR yazın" olmalı.
2. **Sadece memnun müşteriye yorum linki atmak.** Google yasaklıyor, yorumları siliyor. Herkese atın. Yorum karşılığında indirim de vermeyin.
3. **Asistanın bot olduğunu saklamak.** İlk mesajda "Ben Lara Güzellik'in dijital asistanıyım" desin ve her zaman insana bağlanma seçeneği sunsun.
4. **Sağlık bilgisi toplamak.** Alerji, hastalık gibi bilgileri asistan sormasın.
5. **KVKK'yı atlamak.** Mesajlar ABD'deki sunucularda (Meta, Anthropic) işleniyor. Aydınlatma metni, gerekli bildirimler ve salonla aranızda bir veri işleme sözleşmesi gerekir. **Bir avukata baktırın.**

---

## 8. Takvim (yaklaşık 12 hafta)

| Hafta | Ne yapılıyor |
|---|---|
| 1 | Alan adı, Meta doğrulaması ve App Review başvurusu, Anthropic hesabı, avukat |
| 2-3 | Temel sistem: subdomain'li panel, giriş, admin paneli, salon açma, takvim, hizmetler, çalışanlar |
| 4-5 | WhatsApp bağlama, gelen kutusu, Claude asistanı, randevu açma |
| 6-7 | Otomasyonlar: hatırlatma, Google yorum, tekrar işlem, yan ürün önerisi, boş saat doldurma |
| 8-9 | Kampanyalar, kuponlar, müşteri grupları, raporlar |
| 10 | Instagram DM, salon web sitesi |
| 11-12 | 2-3 pilot salonla deneme, düzeltmeler, fiyatın netleşmesi |

---

## 9. Sizden beklenen kararlar

1. **Alan adı ne olacak?**
2. **Yeni GitHub reposu:** Bu proje ayrı bir repoda olmalı. Repoyu siz açın ve bu oturuma ekleyin.
3. **AI modeli:** En akıllısı (Opus 5.5, ~50 $/salon) mı, ölçtükten sonra daha ucuzu mu?
4. **WhatsApp ücretleri:** Salonun kendi kartından mı (önerilen), yoksa sizin paketinizin içinden mi?
5. **Meta onayı beklenirken** çözüm ortağıyla (360dialog vb.) başlanacak mı?
