# Canlıya Çıkış Kontrol Listesi

Hedef ortam: **Vercel + Neon (PostgreSQL) + Vercel Blob + Resend**. Tamamı ücretsiz katmanlarla başlar; tek zorunlu masraf **alan adıdır** (aşağıya bakın).

> Vercel Hobby (ücretsiz) planı ticari kullanıma izin vermez. Deneme döneminde Hobby yeterlidir; işletmelerden ücret almaya başlamadan önce **Vercel Pro**'ya geçin.

---

## 1. Alan adı (zorunlu, ücretli)

- [ ] Alan adı alın (ör. `.com` veya `.com.tr`).
- [ ] Vercel → Project → Settings → Domains: alan adını ekleyin, DNS kayıtlarını girin. HTTPS sertifikası otomatik gelir.
- [ ] **Neden zorunlu:** Resend, alan adı doğrulanmadan yalnızca sizin kendi e-posta adresinize gönderim yapar. Doğrulama e-postası, şifre sıfırlama ve randevu e-postaları müşterilere ancak doğrulanmış alan adıyla gider. `vercel.app` adresi e-posta için doğrulanamaz.

## 2. Veritabanı (Neon)

- [ ] Neon'da proje açın, bölge **Frankfurt (eu-central-1)**: Vercel `fra1` ile aynı bölge, düşük gecikme.
- [ ] İki bağlantı adresi alın: *pooled* (uygulama için) ve *direct* (migration için).
- [ ] Yerelden kurulum:
  ```bash
  DATABASE_URL="<direct adres>" npm run db:migrate
  DATABASE_URL="<direct adres>" npm run db:seed
  DATABASE_URL="<direct adres>" ADMIN_EMAIL=... ADMIN_NAME="..." ADMIN_PASSWORD='...' npm run admin:create
  ```
  `btree_gist` uzantısı migration ile kurulur; Neon destekler.
- [ ] Yedekleme: Neon ücretsiz katmanında geri dönüş penceresi kısadır. Haftalık `pg_dump` alıp güvenli bir yerde saklayın:
  ```bash
  pg_dump "<direct adres>" -Fc -f yedek-$(date +%F).dump
  ```

## 3. Vercel projesi

- [ ] GitHub deposunu Vercel'e bağlayın (Framework: Next.js; ayarlar otomatik gelir).
- [ ] Fonksiyon bölgesi `vercel.json` ile `fra1` olarak ayarlıdır.
- [ ] **Storage → Blob** oluşturun; `BLOB_READ_WRITE_TOKEN` otomatik eklenir.
- [ ] Ortam değişkenleri (Production):

| Değişken | Değer |
|---|---|
| `DATABASE_URL` | Neon **pooled** bağlantı adresi |
| `APP_URL` | `https://alanadiniz.com` (sonunda `/` olmadan) |
| `CRON_SECRET` | Uzun rastgele değer, ör. `openssl rand -hex 32` |
| `RESEND_API_KEY` | Resend API anahtarı |
| `EMAIL_FROM` | `Berber Randevu <bildirim@alanadiniz.com>` |
| `BLOB_READ_WRITE_TOKEN` | Blob oluşturulunca otomatik eklenir |

- [ ] Günlük görev (`/api/cron/daily`) `vercel.json` ile her gün 06:00 UTC (09:00 TR) çalışır. Hobby planında günde bir çalışmaya izin verilir, bu yeterlidir.
  Görevin işleri: abonelik gecikme e-postaları ve 7. gün askıya alma, süresi dolan randevu taleplerinin iptali, yarınki randevu hatırlatmaları, güven puanları, eski oturum temizliği.

## 4. E-posta (Resend)

- [ ] Resend'de alan adını ekleyin; SPF/DKIM DNS kayıtlarını girip doğrulayın.
- [ ] Ücretsiz katman: günde 100, ayda 3.000 e-posta. Kullanım artınca ücretli plana geçin.
- [ ] Test: kayıt olun → doğrulama e-postası gelmeli; spam klasörüne düşüyorsa DMARC kaydı ekleyin.

## 5. İlk yapılandırma (admin paneli)

- [ ] `/admin` ile giriş yapın, şifrenizi güçlü tutun.
- [ ] **Ayarlar:** iletişim e-postası/telefon, uyarı e-postası (ödeme ve gecikme bildirimleri buraya gelir), banka/IBAN bilgileri.
- [ ] **Ayarlar → yasal metinler:** KVKK aydınlatma metni ve kullanım koşulları. Bu metinleri bir hukukçuya kontrol ettirin.
- [ ] **Sözleşmeler:** işletme sözleşmesini yayınlayın; işletmeler panelde onaylar.
- [ ] **Belge türleri:** vergi levhası ve işyeri açma ruhsatı zorunlu olarak tanımlıdır; gerekirse düzenleyin.
- [ ] **Abonelikler:** paket fiyatlarını kontrol edin (varsayılan 699,90 TL/ay, 6.990 TL/yıl). Kampanya ayarlarında ilk 20 işletmeye 3 ay, diğerlerine 1 ay ücretsiz tanımlıdır.
  **Ücretlendirme anahtarı kapalı** başlar: açtığınız gün deneme süreleri işlemeye başlar.
- [ ] **Bannerlar, hizmet türleri, resmî tatiller:** gözden geçirin.

## 6. Yasal (Türkiye)

- [ ] Şirket kuruluşu ve vergi kaydı: abonelik ücreti almadan önce.
- [ ] KVKK: VERBİS kayıt yükümlülüğünüzü kontrol edin; aydınlatma metni ve açık rıza metinleri yayında olmalı.
- [ ] Mesafeli satış ve abonelik sözleşmesi: işletmelere kartla ödeme açılmadan önce hazırlanmalı.
- [ ] Fatura: her ödemede admin e-posta alır ve PDF faturayı ödemeye yükler. E-fatura/e-arşiv için mali müşavirinizle çalışın.

## 7. Kartla otomatik ödeme (şirket kurulduktan sonra)

Altyapı hazırdır; kart bilgisi hiçbir zaman bizim sunucumuza gelmez.

- [ ] Sağlayıcı seçin (iyzico / PayTR, abonelik API'si olan).
- [ ] `src/server/modules/billing/gateway.ts` içindeki `PaymentGateway` arayüzünü uygulayın: `startCardSetup`, `updateSubscription` (aylık ↔ yıllık), `cancelSubscription`, `parseWebhook` (imza doğrulamalı).
- [ ] Sağlayıcının bildirimleri için `/api/odeme/webhook` route'u ekleyin: `parseWebhook` → `handleGatewayEvent`.
- [ ] `getPaymentGateway()` uygulamayı döndürsün; sağlayıcı anahtarlarını ortam değişkeni olarak ekleyin.
- [ ] Sağlayıcının test ortamında uçtan uca deneyin: kart tanımlama, ilk çekim, başarısız çekim, dönem değişikliği, iptal.

## 8. Yayın öncesi son kontroller

- [ ] `npm test` ve `npm run build && npm run e2e`: hepsi geçmeli.
- [ ] `npm audit --omit=dev`: 0 açık.
- [ ] Canlı adreste: ana sayfa, arama, profil, kayıt → doğrulama e-postası → randevu, işletme paneli onay, admin girişi.
- [ ] Telefon tarayıcısında "Ana ekrana ekle" ile uygulama kurulabiliyor mu? Çevrimdışıyken uyarı sayfası geliyor mu?
- [ ] `https://alanadiniz.com/robots.txt` ve `/sitemap.xml` doğru adresi gösteriyor mu?
- [ ] Vercel → Logs: hata kaydı yok mu? Ertesi sabah cron çalıştı mı (Logs → `/api/cron/daily`, 200)?
- [ ] Google Search Console'a alan adını ve site haritasını ekleyin.

## 9. Ücretsiz katman sınırları (özet)

| Servis | Sınır | Aşılınca |
|---|---|---|
| Vercel Hobby | Ticari kullanım yok; aylık 100 GB trafik; cron günde 1 | Pro (~20 $/ay) |
| Neon Free | 0,5 GB depolama, sınırlı işlem süresi; boşta kalınca uyur (ilk istek ~1 sn gecikir) | Launch planı |
| Vercel Blob (Hobby) | 1 GB depolama | Pro ile artar |
| Resend Free | 100 e-posta/gün, 3.000/ay | Pro (~20 $/ay) |
