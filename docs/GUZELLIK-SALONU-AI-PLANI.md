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

### Web sitesi YOK (karar)

Salona web sitesi verilmez. `lara.senindomain.com` adresi **sadece salonun yönetim paneline** açılır (giriş ekranı → panel).

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

## 4B. ÖDEME MODELİ (KARAR): Meta'ya biz öderiz, salon kart bağlamaz

**Karar:** WhatsApp ücretleri **bizim şirket kartımızdan** çekilir. Salon hiçbir yere kart girmez. Her salonun aylık kotası olur. Kota dolmak üzereyken **bize** e-posta gelir. Biz salonu arar, ek paket satarız.

### 4B.1 Teknik olarak nasıl yapılır? (en ucuz yol)

**Bütün salonların WhatsApp hesapları bizim Meta işletme hesabımızın (Business Portfolio) içinde açılır.**

```
Bizim Meta Business Portfolio'muz  ← bizim kredi kartımız burada (tek kart)
 ├─ WhatsApp hesabı: Lara Güzellik   → numara: 0532 ...
 ├─ WhatsApp hesabı: Mina Beauty     → numara: 0541 ...
 └─ WhatsApp hesabı: Su Estetik      → numara: 0555 ...
```

- Kart bir kere, bizim portföye eklenir. Her yeni salonun WhatsApp hesabı bu kartı kullanır.
- Meta ayda bir **tek fatura** keser. Fatura bizim şirket adımıza olur, muhasebesi kolaydır.
- Aracı firmaya (360dialog, Twilio) para vermeyiz. Onlar mesaj başına ya da numara başına ek ücret alır.
- Salon tarafında yapılacak tek şey: numaraya gelen **doğrulama kodunu** (SMS ya da arama) görüntülü görüşmede bize söylemek.

### 4B.2 Bu yolun dikkat edilecek noktaları

| Konu | Açıklama | Ne yapacağız |
|---|---|---|
| **Görünen ad onayı** | Meta, WhatsApp'ta görünen adın ("Lara Güzellik") gerçek bir işletmeye ait olduğunu görmek ister. Ad bizim şirket adımızla aynı değil. | Salonun kendi Google İşletme profili ve Instagram profilinde salon adı + WhatsApp numarası yazılı olur. Meta bu bağı görür. Reddedilirse salonun vergi levhası ile itiraz edilir. |
| **Numara sayısı sınırı** | Bir portföye başta az sayıda numara eklenebilir. İşletme doğrulamasından sonra limit artar. Daha fazlası için Meta'dan artış istenir. | Salon sayısı arttıkça artış talep edilir. |
| **Gönderim limiti portföy bazında olabilir** | Meta son düzenlemelerle günlük "kaç kişiye ilk mesaj" limitini tüm portföy için ortak saymaya başladı. Başlangıç limiti doğrulanmış hesapta günde 2.000 kişi, sonra 10 bin, 100 bin. | Salon başına ayda 100 mesajla 20 salon, günde ortalama ~70 mesaj eder, limite çok uzak. Kalite yüksek tutulursa limit kendiliğinden büyür. |
| **Bir salon herkesi etkileyebilir** | Bir salon spam atıp şikâyet alırsa portföyün kalite puanı düşebilir. | Kampanyalar sadece izinli müşterilere gider. Kota ve sıklık sınırı uygulanır. Kalite puanı admin panelde izlenir. |
| **Mevcut numarayı telefonda kullanmaya devam etmek (coexistence)** | Bu özellik Meta'nın "Embedded Signup" ekranıyla açılıyor. Numarayı bizim portföyümüze bu şekilde almak teknik olarak mümkün görünüyor ama **pilotta mutlaka denenmeli.** | Olmazsa salon için **yeni bir hat** alınır (en temizi), ya da mevcut numara tamamen API'ye taşınır. |
| **Salon ayrılırsa** | Numara bizim portföyümüzde olduğu için salonun numarasını geri isteme hakkı vardır. | Sözleşmeye "Ayrılırsanız numaranızı size ya da yeni sağlayıcınıza taşırız" yazılır. Numaralar taşınabilir. |

> **B planı:** Bu yol Meta tarafında sorun çıkarırsa Meta'nın **Solution Partner**'ı olan bir aracı firmayla (360dialog Partner programı gibi) "ücreti partner öder" modelinde çalışılır. Ödeme yine bizden çıkar, salon kart bağlamaz, ama aracı ek ücret alır.

### 4B.3 Kota sistemi — nasıl çalışacak?

**1) Paketler (örnek):**

| Paket | Aylık giden WhatsApp mesajı | Aylık AI sohbeti |
|---|---|---|
| Başlangıç | 100 | 300 |
| Ek paket +100 | +100 | +200 |

**2) Sayaç:** Meta her gönderilen mesaj için bize bir durum bildirimi yollar. Bu bildirimde "bu mesaj **ücretli mi** (billable), **hangi kategoride** (utility/marketing)" bilgisi yazar. Sistem sadece **gerçekten ücretli** olan mesajları sayar. 24 saat penceresindeki bedava mesajlar kotadan düşmez. Böylece sayaç Meta faturasıyla birebir aynı olur.

**3) Uyarılar — hepsi BİZE gider, salona değil:**

| Kullanım | Ne olur |
|---|---|
| **%80** | Bize e-posta: "Lara Güzellik kotasının %80'ini kullandı (80/100). Ay sonuna 9 gün var, tahmini ay sonu: 115." |
| **%100** | Bize e-posta: "Lara Güzellik kotayı doldurdu." Admin panelde salon **kırmızı** görünür. |
| **%100 sonrası** | **Kampanya gönderimi otomatik durur.** Randevu hatırlatmaları **gitmeye devam eder,** çünkü salonun işini bozmayız. |
| **%150 (güvenlik tavanı)** | Her şey durur. Sadece müşteriye verilen cevaplar devam eder, onlar zaten bedava. Bize acil e-posta gider. |

- Yüzdeler ve tavan admin panelden salon bazında değiştirilebilir.
- **Erken uyarı:** Sistem ayın ortasında gidişata bakar. "Bu hızla ay sonunda kotayı aşacak" diyorsa %80'i beklemeden e-posta atar.
- Ek paketi admin panelden siz tanımlarsınız: "Lara'ya bu ay +100 ekle". Kota anında büyür.
- Her ayın 1'inde sayaçlar sıfırlanır. Size aylık özet e-postası gelir: salon salon kullanım, Meta maliyeti, AI maliyeti, kâr.

**4) Yapay zekâ (Claude) maliyeti:** Bu da bizim hesabımızdan çıkar. Aynı sistem uygulanır:
- Her sohbetin token maliyeti kaydedilir. Salon kotası %80 ve %100 olduğunda bize e-posta gider.
- Kota dolsa bile asistan susmaz. Gerekirse daha kısa cevaplarla çalışmaya devam eder. Sadece %150 tavanında "Ekibimiz size dönecek" moduna geçer.
- Ayrıca Anthropic Console'da **toplam aylık harcama sınırı** konur. Bu, bütün salonlar için son emniyet kemeridir.

**5) Meta faturasının kontrolü:** Ayda bir, sistemin saydığı tutar Meta'nın fiyat analitiği (pricing analytics) verisiyle karşılaştırılır. Fark varsa bize e-posta gelir.

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

1. Sahip `lara.senindomain.com` adresine girer → **Kanallar → "WhatsApp'ı Bağla"**
2. Meta'nın küçük penceresi açılır. Sahip **kendi Facebook hesabıyla** giriş yapar.
3. "İşletme seç / oluştur" ekranında salon adını ve adresini yazar (web sitesi yerine salonun Instagram ya da Google Haritalar bağlantısı).
4. **Numara seçimi** gelir. Burada üç yol var:
   - **(Önerilen) Mevcut WhatsApp Business numarası:** Salonun bilinen numarası aynen kalır. Telefondaki WhatsApp Business uygulamasında çıkan onay ekranı onaylanır. Salon telefondan da yazmaya devam edebilir.
   - **Yeni numara:** SMS ile gelen 6 haneli kod girilir.
   - **Normal (Business olmayan) WhatsApp kullanıyorsa:** Önce telefona WhatsApp Business uygulaması kurulur ve numara oraya taşınır. Sonra birinci yol uygulanır.
5. Pencere kapanır, panelde "✅ WhatsApp bağlandı" yazar. Sistem arka planda şunları kendiliğinden yapar:
   - mesajları dinlemeye başlar,
   - hatırlatma, randevu onayı, Google yorum ve kampanya **şablonlarını** Meta'ya onaya gönderir. Onay birkaç dakika ile 1 gün arasında gelir.
6. **Kart ekleme YOK.** Salon kart bağlamaz. WhatsApp hesabı bizim portföyümüzde açılır ve bizim kartımızı kullanır (bkz. Bölüm 4B). Bu durumda 2-5. adımları **siz** kendi Meta hesabınızla yaparsınız. Salon sahibi sadece numaraya gelen doğrulama kodunu söyler ya da coexistence QR onayını telefonundan verir.
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
| 10 | Instagram DM |
| 11-12 | 2-3 pilot salonla deneme, düzeltmeler, fiyatın netleşmesi |

---

## 9. Sizden beklenen kararlar

1. **Alan adı ne olacak?**
2. **Yeni GitHub reposu:** Bu proje ayrı bir repoda olmalı. Repoyu siz açın ve bu oturuma ekleyin.
3. **AI modeli:** En akıllısı (Opus 5.5, ~50 $/salon) mı, ölçtükten sonra daha ucuzu mu?
4. ~~WhatsApp ücretleri~~ → **KARAR VERİLDİ:** Meta'ya biz öderiz. Kota ve ek paket modeli uygulanır (Bölüm 4B).
5. **Meta onayı beklenirken** çözüm ortağıyla (360dialog vb.) başlanacak mı?

---

## 10. KARAR: Kampanyaları salon kendi telefonundan atar

Sistem kampanya göndermez. Salon kampanyayı **kendi WhatsApp Business uygulamasından** elle atar.

**Mümkün mü?** Evet. Ama salonun numarasının nasıl kurulduğuna göre durum değişir:

| Kurulum | Salon telefondan kampanya atınca ne olur? |
|---|---|
| **Aynı numara hem telefonda hem sistemde (coexistence)** | Telefondan atılan mesajlar **bedava** (uygulama mesajlarına ücret yok). Sistem bu mesajları da görür ve gelen kutusuna düşürür. Müşteri cevap verirse asistan da görür. |
| **Sisteme yeni hat alındıysa** | Salon kampanyayı eski numarasından atar. Sistemle hiç ilgisi yoktur, sistemi hiç etkilemez. Ama müşterinin cevabı eski numaraya gider, asistan göremez. |

**Sistemi etkiler mi? Etkileyebilecek 3 nokta:**

1. **Numara cezası riski (en önemlisi):** Coexistence'ta numara ortaktır. Salon telefondan izinsiz ya da çok sık kampanya atar, müşteriler "engelle / spam bildir" derse **aynı numara** Meta tarafından kısıtlanabilir ya da kapatılabilir. O zaman asistan ve hatırlatmalar da durur. Numaralar bizim portföyümüzde olduğu için portföy kalite puanı da etkilenebilir.
   → Önlem: Sözleşmeye "Kampanyayı sadece izin veren müşterilere, ayda en fazla 2 kez atarım" maddesi koyulur. Admin panelde numara kalite puanı izlenir. Puan düşerse bize anında uyarı gelir.
2. **Asistanın araya girmesi:** Salon telefondan bir müşteriyle yazışıyorsa asistan o sohbete karışmamalı.
   → Kural: Salon telefondan bir müşteriye yazdığı an, asistan o müşteriyle sohbette **24 saat susar** (ayarlanabilir).
3. **Telefondaki yayın listesi sınırları:** WhatsApp Business uygulamasında yayın listesi ile mesaj sadece **numaranızı rehberine kaydetmiş** kişilere ulaşır. Bir liste en fazla 256 kişi alır.

**Kanun:** Kampanyayı kim atarsa atsın, ticari ileti kuralları (izin, ret hakkı, İYS) geçerlidir. Sorumluluk salonda olur. Sözleşmede bu yazılmalıdır.

**Maliyete etkisi:**
- Pazarlama mesajı ücreti sıfırlanır.
- **Yan ürün önerisi** ve **"işlem zamanınız geldi" mesajları da Meta'ya göre pazarlama sayılır.** Bunlar:
  - ya müşteri son 24 saat içinde yazdıysa o pencerede bedava gönderilir,
  - ya da randevu sonrası teşekkür mesajının içine eklenir (o da 24 saat penceresi içindeyse bedava olur).
- Sonuçta ücretli kalan neredeyse sadece **randevu hatırlatmaları** olur.

**Kolaylık (bedava):** Panelde "Kampanya Taslağı" düğmesi olur. Asistan kampanya metnini yazar, uygun müşteri listesini (izinli olanlar) çıkarır. Salon tek tıkla kopyalar ve telefondan gönderir.

---

## 11. Sorun çıkarsa: anında fark etmek ve çözmek

### Anında haberimiz olsun (izleme)

| Ne izlenir | Nasıl | Bize nasıl haber gelir |
|---|---|---|
| Site ve API ayakta mı | Uptime izleme, 1 dakikada bir (UptimeRobot / Better Stack, ücretsiz) | Anında Telegram + e-posta |
| Kodda hata | Sentry (ücretsiz katman) | Anında Telegram + e-posta |
| Bir salona saatlerdir mesaj gelmiyor (normalde gelirdi) | Kendi kontrolümüz, 15 dakikada bir | Telegram |
| Meta: numara kalitesi düştü, numara kısıtlandı, şablon reddedildi, token geçersiz | Meta'nın kendi bildirimleri (webhook) | Anında Telegram + e-posta |
| Claude cevap vermiyor | Hata sayacı | Anında Telegram |
| Mesaj gönderilemedi (hata kodu) | Meta durum bildirimleri | Topluca, 15 dakikada bir |

### Hemen müdahale (admin panelde)

- **Canlı durum ekranı:** Her salonun yanında yeşil, sarı ya da kırmızı ışık.
- **"Destek olarak gir":** Salonun panelini onun gözünden görürsünüz. Her giriş kayda geçer.
- **Asistanı kapat düğmesi:** Tek salon için ya da **bütün salonlar** için. Kapalıyken müşteriye "Mesajınızı aldık, ekibimiz size dönecek" gider ve salon telefondan devam eder.
- **Ayar düzeltme:** Fiyat, saat, sık sorulan sorular ve asistan talimatları panelden değişir, **saniyeler içinde** geçerli olur. Kod yüklemek gerekmez.

### Kendi kendini koruyan sistem (biz uyurken bile)

- **Claude çökerse:** Otomatik "Ekibimiz dönecek" cevabı gider ve salona bildirim düşer.
- **Bizim sunucu çökerse:** Meta mesajları kaybetmez, **saatlerce tekrar dener.** Sunucu açılınca mesajlar işlenir. Coexistence'ta salon telefondan cevap vermeye devam eder.
- **Aynı hatırlatma iki kez gitmez:** Her gönderimin tekrar gönderimi engelleyen bir kilidi vardır.

### Ne kadar hızlı çözülür?

| Sorun | Çözüm süresi |
|---|---|
| Asistan yanlış bilgi veriyor, ayar hatası | **Dakikalar.** Panelden düzeltilir. |
| Koddaki hata | **10-30 dakika.** Düzeltilir, GitHub'a gönderilir, otomatik yayına çıkar. Kötü bir güncelleme **tek tıkla geri alınır.** |
| Sunucu ya da veritabanı sorunu | Dakikalar ile 1 saat arası. Günlük yedekler alınır. |
| **Meta kaynaklı** (numara kısıtlandı, şablon reddedildi, görünen ad onaylanmadı, Meta'nın genel kesintisi) | **Anında çözülemez.** Saatler ile günler arası sürer. Meta destek talebi açılır. → Önlem: Her şablonun yedek bir versiyonu önceden onaylı tutulur. Kalite puanı izlenir. |

**Gerçekçi beklenti:** Bizim tarafımızdaki sorunların çoğu dakikalar içinde çözülür. Meta tarafındaki sorunlar bizim elimizde değildir. Onlar için önlem almak, sonradan çözmekten daha önemlidir.

---

## 12. KARAR: Salonun kendi yazdığı mesajlar kotadan düşmez

**Kural:** Kotadan sadece **sistemin otomatik gönderdiği ücretli mesajlar** düşer. Örnek: süresi geçmiş müşteriye randevu hatırlatması.

| Mesaj | Kotadan düşer mi? | Neden |
|---|---|---|
| Salonun **telefondaki WhatsApp Business uygulamasından** yazdığı her şey (kampanya, sohbet, yayın listesi) | **Hayır** | Uygulamadan gönderilen mesajlara Meta ücret almaz. Sistem bunları görür ve gelen kutusunda gösterir, ama sayaca **hiç eklemez.** |
| Asistanın ya da çalışanın, müşteri yazdıktan sonra **24 saat içinde** verdiği cevaplar | **Hayır** | Meta ücret almaz |
| Çalışanın **panelden** elle yazdığı mesaj (24 saat içinde) | **Hayır** | Meta ücret almaz |
| Sistemin otomatik attığı hatırlatma (müşteri son 24 saatte yazmadıysa) | **Evet** | Meta ücret alır |

**Teknik garanti:** Sayaç iki şarta birlikte bakar:
1. Mesaj **sistemin API'si** üzerinden gönderilmiş olmalı.
2. Meta o mesaj için **"ücretli" (billable: true)** demiş olmalı.

Telefondan atılan mesajlar API'den gitmediği için sayaca giremez.

**Panelde 24 saat dışı yazma:** Panelden 24 saat penceresi dışında serbest mesaj yazılamaz, Meta izin vermez. O durumda panel "Bu müşteriye telefonunuzdaki WhatsApp'tan yazın (ücretsiz)" uyarısını gösterir. Böylece salon farkında olmadan ücretli şablon harcamaz.

**Not:** Telefondaki uygulamada 24 saat kuralı **yoktur.** Salon kampanyayı istediği zaman, ücretsiz atabilir. "24 saat" kuralı sadece sistemin (API'nin) attığı mesajlar için geçerlidir.

**Asistan kotası (AI):** Salonun telefondan ya da panelden yazdığı mesajlar AI kotasından da düşmez. AI kotasına sadece asistanın kendi ürettiği cevaplar sayılır.

---

## 13. Çalışan yönetimi ve randevu atama (salon panelinden)

**Salon kendi panelinden şunları yapar:**
- Çalışan ekler ve çıkarır. Vardiya, mola, izin ve hangi hizmetleri yaptığını tanımlar.
- Rol verir: **sahip / yönetici / çalışan**. Çalışan kendi girişiyle sadece kendi takvimini görür.
- Gelen randevuyu istediği çalışana atar. Takvimde sürükle-bırak ile başka çalışana aktarır.
- Haftalık iş yükü tablosunu görür: çalışan başına randevu sayısı, çalışılan saat, doluluk yüzdesi. Dengesizlik olursa panel uyarır ("Elif'in yükü %30 fazla").

**Atama modları (salon ayarlardan seçer):**

| Mod | Nasıl çalışır |
|---|---|
| **Otomatik adil** (varsayılan) | O hizmeti yapabilen ve o saatte boş olan çalışanlar arasından, **bu hafta en az dakika çalışmış** olana verilir. Eşitlik olursa sırayla verilir. |
| **Yönetici atar** | Asistan saati ayırır, randevu "atanmamış" kutusuna düşer, yönetici dağıtır. Saat tutulduğu için çakışma olmaz. |
| **Müşteri seçer** | Müşteri "Elif Hanım olsun" derse randevu Elif'e yazılır. Tercih belirtmezse otomatik adil mod çalışır. |

- Aynı çalışana aynı saatte iki randevu verilmesi veritabanı seviyesinde engellenir.
- Çalışana yeni randevu bildirimi **panel ve telefon (PWA) bildirimi** ile gider. Bu ücretsizdir. WhatsApp ile gitmez, çünkü o ücretli olur.

---

## 14. Bağlantıları salon kendisi kurar, biz şifre istemeyiz

**Kural:** Salondan hiçbir şifre ya da hesap bilgisi istenmez. Salon panelinde "Bağla" düğmesine basar, adımları kendisi tamamlar. Bundan sonrası **otomatik** kurulur: webhook aboneliği, numara kaydı, şablonların onaya gönderilmesi ve test mesajı. Başarılı olursa panelde ✅ yanar, olmazsa bize anında uyarı gelir. *(Bu bölüm, Bölüm 6'daki "siz yaparsınız" anlatımının yerine geçer.)*

- **Instagram:** Sorun yok. Salon kendi Instagram girişiyle izin verir. Panel, "Mesajlara erişime izin ver" ayarı için resimli yönlendirme gösterir.
- **Google:** Salon Haritalar bağlantısını yapıştırır.
- **WhatsApp:** "Salon kendisi bağlasın" + "ücreti biz ödeyelim" kararlarını birlikte sağlamanın iki yolu var. **Karar bekliyor:**

| Yol | Salon kendisi bağlar | Kart bizden | Aynı numara telefonda da çalışır | Ek maliyet |
|---|---|---|---|---|
| **1) Panelden numara + SMS kodu** (numara API ile bizim Meta hesabımıza eklenir) | Evet | Evet | **Hayır.** Numara telefondaki WhatsApp'tan silinmeli. Asistan için ayrı hat önerilir. | Yok |
| **2) Meta'nın bağlanma ekranı + Solution Partner aracı** (ücreti partner öder, bize fatura eder) | Evet | Evet | Evet (coexistence) | Var (numara ya da mesaj başı, teklif alınmalı) |
| 3) Meta'nın bağlanma ekranı, aracısız | Evet | **Hayır, salon kart girer** | Evet | Yok |

Kartı bizim ödeyebilmemiz için iki yoldan biri gerekir: ya numara bizim hesabımızda olacak (Yol 1), ya da Meta'nın kredi paylaştırma yetkisi olan bir partner araya girecek (Yol 2). Yol 3, "salon kart bağlamaz" kararına aykırıdır. Yol 1 seçilirse "kampanyaları salon aynı numaradan telefonla atar" kararı değişir: kampanyalar salonun eski numarasından atılır.
