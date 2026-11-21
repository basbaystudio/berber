# Canlıya Çıkış Kontrol Listesi

Adres: **https://dijitalberber.com** · Ortam: **Vercel + Neon (PostgreSQL) + Vercel Blob + Resend**. Tamamı ücretsiz katmanlarla başlar; alan adı alındı.

> Vercel Hobby (ücretsiz) planı ticari kullanıma izin vermez. Deneme döneminde Hobby yeterlidir; işletmelerden ücret almaya başlamadan önce **Vercel Pro**'ya geçin.

---

## 1. Hesaplar

Hepsi ücretsiz açılır. Vercel'e GitHub hesabınızla girin; Neon ve Blob'u Vercel içinden açacağız.

- [ ] **Vercel** (vercel.com): "Continue with GitHub" ile giriş.
- [ ] **Resend** (resend.com): e-posta gönderimi için.

## 2. Vercel projesi ve veritabanı

- [ ] Vercel → **Add New → Project** → `basbaystudio/berber` deposunu seçin → **Deploy**'a henüz basmayın, önce aşağıdaki değişkenleri ekleyin. (İlk denemede hata verirse sorun değil; değişkenleri ekleyip **Redeploy** yaparsınız.)
- [ ] Proje → **Storage → Create Database → Neon (Postgres)**, bölge **Frankfurt**. Vercel `DATABASE_URL` değişkenini kendisi ekler.
- [ ] Proje → **Storage → Create → Blob**. `BLOB_READ_WRITE_TOKEN` kendiliğinden eklenir.
- [ ] Proje → **Settings → Environment Variables** (Production):

| Değişken | Değer |
|---|---|
| `APP_URL` | `https://dijitalberber.com` |
| `CRON_SECRET` | 40+ karakterlik rastgele bir metin (bir şifre üreticiden alın) |
| `RESEND_API_KEY` | Resend → API Keys'ten alınan anahtar (4. adım) |
| `EMAIL_FROM` | `Dijital Berber <bildirim@dijitalberber.com>` |
| `ADMIN_EMAIL` | Yönetici girişinde kullanacağınız e-posta |
| `ADMIN_NAME` | Adınız soyadınız |
| `ADMIN_PASSWORD` | En az 12 karakter, harf + rakam. **İlk girişten sonra bu değişkeni silin.** |

- [ ] **Deploy / Redeploy.** Her canlı dağıtımda veritabanı tabloları, il/ilçe ve hizmet türleri **otomatik** kurulur ve ilk yönetici hesabı açılır (`scripts/deploy-setup.ts`). Bilgisayarınızda komut çalıştırmanız gerekmez. Önizleme dağıtımları veritabanına dokunmaz.
- [ ] Günlük görev (`/api/cron/daily`) her gün 09:00'da (TR) kendiliğinden çalışır: abonelik gecikme e-postaları ve 7. gün askıya alma, süresi dolan taleplerin iptali, yarınki randevu hatırlatmaları, güven puanları, temizlik.

## 3. Alan adı: dijitalberber.com (Natro)

En kolay yol: alan adının **ad sunucularını Vercel'e yönlendirmek**. Böylece tüm DNS kayıtlarını (site + e-posta) Vercel ekranından yönetirsiniz.

- [ ] Vercel → Proje → **Settings → Domains** → `dijitalberber.com` ekleyin (www'yu da ekleyin; Vercel yönlendirmeyi önerir).
- [ ] Vercel size **ad sunucularını** gösterir (genelde `ns1.vercel-dns.com`, `ns2.vercel-dns.com`).
- [ ] Natro paneli → alan adınız → **ad sunucusu (nameserver / DNS sunucusu) değiştir** → Vercel'in verdiği iki adresi girin, kaydedin.
- [ ] Yayılması birkaç dakika ile 24 saat sürebilir. Vercel'de alan adının yanında yeşil onay görünce HTTPS de otomatik açılır.

> Ad sunucularını değiştirmek istemezseniz: Natro'nun DNS yönetiminde Vercel'in **Domains** ekranında gösterdiği A (kök alan) ve CNAME (www) kayıtlarını aynen girin.

## 4. E-posta (Resend)

- [ ] Resend → **Domains → Add Domain** → `dijitalberber.com`, bölge **EU (Frankfurt)**.
- [ ] Resend'in gösterdiği DNS kayıtlarını (MX, TXT/SPF, DKIM) **Vercel → Domains → dijitalberber.com → DNS Records** ekranına tek tek girin (3. adımda ad sunucusunu Vercel'e verdiyseniz). Natro'da kaldıysanız Natro DNS yönetimine girin.
- [ ] Resend'de **Verify** → yeşil olunca **API Keys → Create** ile anahtarı alın ve Vercel'de `RESEND_API_KEY` olarak ekleyip **Redeploy** yapın.
- [ ] Ücretsiz katman: günde 100, ayda 3.000 e-posta.
- [ ] Test: siteden müşteri olarak kayıt olun → doğrulama e-postası gelmeli. Spam'e düşerse Resend'in önerdiği DMARC kaydını da ekleyin.
- [ ] Gelen kutusu: `bildirim@` yalnızca gönderim içindir. `info@dijitalberber.com` gibi okunacak bir adres isterseniz Natro'nun e-posta hizmeti ya da Zoho/Google Workspace kullanın (MX kayıtları Resend'inkilerle çakışmaz; Resend gönderim için `send.` alt alanını kullanır).

## 5. Yedekleme

- [ ] Neon ücretsiz katmanında geri dönüş penceresi kısadır. Neon panelinden düzenli olarak **branch/yedek** alın ya da haftalık `pg_dump` için bize başvurun.

## 6. İlk yapılandırma (admin paneli)

- [ ] `https://dijitalberber.com/admin` ile giriş yapın. Ardından Vercel'den `ADMIN_PASSWORD` değişkenini silin.
- [ ] **Ayarlar:** iletişim e-postası/telefon, uyarı e-postası (ödeme ve gecikme bildirimleri buraya gelir), banka/IBAN bilgileri.
- [ ] **Ayarlar → yasal metinler:** KVKK aydınlatma metni ve kullanım koşulları. Bu metinleri bir hukukçuya kontrol ettirin.
- [ ] **Sözleşmeler:** işletme sözleşmesini yayınlayın; işletmeler panelde onaylar.
- [ ] **Belge türleri:** vergi levhası ve işyeri açma ruhsatı zorunlu olarak tanımlıdır; gerekirse düzenleyin.
- [ ] **Abonelikler:** paket fiyatlarını kontrol edin (varsayılan 699,90 TL/ay, 6.990 TL/yıl). Kampanya ayarlarında ilk 20 işletmeye 3 ay, diğerlerine 1 ay ücretsiz tanımlıdır.
  **Ücretlendirme anahtarı kapalı** başlar: açtığınız gün deneme süreleri işlemeye başlar.
- [ ] **Bannerlar, hizmet türleri, resmî tatiller:** gözden geçirin.

## 7. Yasal (Türkiye)

- [ ] Şirket kuruluşu ve vergi kaydı: abonelik ücreti almadan önce.
- [ ] KVKK: VERBİS kayıt yükümlülüğünüzü kontrol edin; aydınlatma metni ve açık rıza metinleri yayında olmalı.
- [ ] Mesafeli satış ve abonelik sözleşmesi: işletmelere kartla ödeme açılmadan önce hazırlanmalı.
- [ ] Fatura: her ödemede admin e-posta alır ve PDF faturayı ödemeye yükler. E-fatura/e-arşiv için mali müşavirinizle çalışın.

## 8. Kartla otomatik ödeme (şirket kurulduktan sonra)

Altyapı hazırdır; kart bilgisi hiçbir zaman bizim sunucumuza gelmez.

- [ ] Sağlayıcı seçin (iyzico / PayTR, abonelik API'si olan).
- [ ] `src/server/modules/billing/gateway.ts` içindeki `PaymentGateway` arayüzünü uygulayın: `startCardSetup`, `updateSubscription` (aylık ↔ yıllık), `cancelSubscription`, `parseWebhook` (imza doğrulamalı).
- [ ] Sağlayıcının bildirimleri için `/api/odeme/webhook` route'u ekleyin: `parseWebhook` → `handleGatewayEvent`.
- [ ] `getPaymentGateway()` uygulamayı döndürsün; sağlayıcı anahtarlarını ortam değişkeni olarak ekleyin.
- [ ] Sağlayıcının test ortamında uçtan uca deneyin: kart tanımlama, ilk çekim, başarısız çekim, dönem değişikliği, iptal.

## 9. Yayın öncesi son kontroller

- [ ] `npm test` ve `npm run build && npm run e2e`: hepsi geçmeli.
- [ ] `npm audit --omit=dev`: 0 açık.
- [ ] Canlı adreste: ana sayfa, arama, profil, kayıt → doğrulama e-postası → randevu, işletme paneli onay, admin girişi.
- [ ] Telefon tarayıcısında "Ana ekrana ekle" ile uygulama kurulabiliyor mu? Çevrimdışıyken uyarı sayfası geliyor mu?
- [ ] `https://dijitalberber.com/robots.txt` ve `/sitemap.xml` doğru adresi gösteriyor mu?
- [ ] Vercel → Logs: hata kaydı yok mu? Ertesi sabah cron çalıştı mı (Logs → `/api/cron/daily`, 200)?
- [ ] Google Search Console'a alan adını ve site haritasını ekleyin.

## 10. Ücretsiz katman sınırları (özet)

| Servis | Sınır | Aşılınca |
|---|---|---|
| Vercel Hobby | Ticari kullanım yok; aylık 100 GB trafik; cron günde 1 | Pro (~20 $/ay) |
| Neon Free | 0,5 GB depolama, sınırlı işlem süresi; boşta kalınca uyur (ilk istek ~1 sn gecikir) | Launch planı |
| Vercel Blob (Hobby) | 1 GB depolama | Pro ile artar |
| Resend Free | 100 e-posta/gün, 3.000/ay | Pro (~20 $/ay) |
