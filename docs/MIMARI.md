# Berber Pazaryeri ve Randevu Platformu — Mimari Doküman (Aşama 1)

> Durum: Aşama 1–3 tamamlandı. Kararlar için bkz. §8.
> Dil: Türkçe · Para birimi: TL (veritabanında kuruş, tam sayı) · Saat dilimi: Europe/Istanbul

---

## 0. Mevcut Durum Analizi

Depoda yalnızca boş bir `README.md` var. Ne mevcut kod ne de bağımlılık bulunuyor. Bu yüzden proje sıfırdan, aşağıdaki mimariyle kurulacak.

---

## 1. Teknoloji Yığını

| Katman | Seçim | Neden |
|---|---|---|
| Dil | **TypeScript (strict)** | Frontend ile backend aynı tipleri kullanır, uçtan uca tip güvenliği olur. |
| Uygulama çatısı | **Next.js (App Router, güncel kararlı sürüm) + React 19** | Tek kod tabanında hem SSR/SEO'lu pazaryeri sayfaları hem paneller hem API. PWA'ya dönüşüm kolay (manifest + service worker). |
| Backend | Next.js Route Handler + Server Action'lar, ama **iş mantığı framework'ten bağımsız bir `server/modules` katmanında** | Tek merkezi backend olur. İleride ayrı bir API servisine (mobil uygulama vb.) taşımak gerekirse modüller olduğu gibi taşınabilir. |
| Barındırma | **Vercel** (fonksiyon bölgesi: `fra1` Frankfurt) | Karar verildi. Veritabanı ve servisler aynı bölgede tutularak gecikme düşük tutulur. |
| Veritabanı | **PostgreSQL — Neon (Vercel Marketplace, Frankfurt) (+ btree_gist; arama için ileride pg_trgm, unaccent)** | Randevu çakışmasını **veritabanı seviyesinde** engelleyen *exclusion constraint*, konum için enlem/boylam (PostGIS gerekmez), Türkçe metin araması ve sağlam transaction desteği. |
| ORM | **Drizzle ORM + drizzle-kit migration** | SQL'e yakın, tip güvenli ve hafif. `tstzrange`, exclusion constraint ve `FOR UPDATE` gibi ileri SQL özelliklerini rahatça kullanmaya izin veriyor. |
| Doğrulama | **Zod** | Aynı şema hem formda hem API'de kullanılır. Backend doğrulaması her zaman zorunlu. |
| Kimlik doğrulama | **Kendi oturum katmanımız** (opak token + DB oturumu, **Argon2id** hash) | Üç ayrı giriş alanını (müşteri / işletme / admin) katı şekilde ayırmak, hazır kütüphanelerle zorlama ve sızıntıya açık olurdu. Kod küçük ve denetlenebilir kalıyor. |
| Dosya depolama | **Vercel Blob** (bir depolama arayüzünün arkasında; yerelde disk adaptörü) + **sharp** | Fotoğraf sunucuda doğrulanır, WebP'ye dönüştürülür ve EXIF temizlenir. Veritabanında yalnızca anahtar/URL ve metadata tutulur. |
| Rate limit / önbellek | **PostgreSQL** (atomik sayaç tablosu) | Ek servis ve ücret gerektirmez. Yük artarsa Redis'e geçilebilir. |
| UI | **Tailwind CSS + shadcn/ui (Radix)**, ikonlar: lucide | Erişilebilir, sade ve tutarlı bileşenler. |
| Takvim | Kendi geliştirdiğimiz gün / hafta / ay görünümü (çalışan sütunlu) | FullCalendar'ın çalışan sütunlu (resource) görünümleri ücretli lisans istiyor. |
| Grafik | Recharts | Panel istatistikleri için. |
| Harita | **Leaflet + OpenStreetMap** (ücretsiz) | Karar verildi. |
| Tarih/saat | `date-fns` + `@date-fns/tz` | Tüm hesaplamalar Europe/Istanbul'da yapılır, DB'de `timestamptz` (UTC) tutulur. |
| Test | **Vitest** (birim + entegrasyon, gerçek Postgres ile), **Playwright** (E2E + mobil görünüm) | Çakışma testleri gerçek veritabanında, eşzamanlı isteklerle koşturulur. |
| Loglama / hata | pino + merkezi `AppError` yapısı, isteğe bağlı Sentry | |
| E-posta | **Resend** (ücretsiz katman) | Doğrulama ve randevu bildirimleri. |
| Geliştirme ortamı | Docker Compose (Postgres) — yalnızca yerel geliştirme ve testler için | |

---

## 2. Proje Klasör Yapısı

```
berber/
├─ docs/                         # Mimari, karar kayıtları
├─ docker-compose.yml            # yerel: postgres(postgis), redis
├─ drizzle/                      # SQL migration dosyaları (exclusion constraint vb. dahil)
├─ public/                       # statik dosyalar, ileride PWA manifest/ikonlar
├─ scripts/                      # seed (il/ilçe, hizmet türleri, ilk admin)
├─ src/
│  ├─ app/
│  │  ├─ (pazaryeri)/            # Herkese açık: "/", "/ara", "/berber/[slug]"
│  │  │  ├─ page.tsx
│  │  │  ├─ ara/
│  │  │  └─ berber/[slug]/       # profil + /randevu adımları
│  │  ├─ (musteri)/              # "/giris", "/kayit", "/hesabim/*" (randevularım, favoriler, puanlar)
│  │  ├─ isletme/
│  │  │  ├─ giris/[[...slug]]/   # işletmeye özel giriş bağlantısı desteği
│  │  │  └─ panel/               # genel bakış, takvim, çalışanlar, hizmetler, paketler,
│  │  │                          # çalışma saatleri, portfolyo, müşteriler, sadakat, ayarlar
│  │  ├─ admin/
│  │  │  ├─ giris/
│  │  │  └─ (panel)/             # işletmeler, istatistikler, raporlar, tatil günleri, hizmet türleri
│  │  └─ api/                    # Route handler'lar (ince katman → modüller)
│  ├─ server/                    # *** Yalnızca sunucuda çalışır ("server-only") ***
│  │  ├─ db/
│  │  │  ├─ schema/              # Drizzle tablo tanımları (modül başına dosya)
│  │  │  └─ client.ts
│  │  ├─ auth/                   # oturum, hash, realm guard'ları, rate limit
│  │  ├─ modules/
│  │  │  ├─ business/            # işletme profili, ayarlar, çalışma saatleri, istisnalar
│  │  │  ├─ staff/               # çalışan, vardiya, mola, izin, yetkinlik
│  │  │  ├─ catalog/             # hizmet, paket, hizmet türleri
│  │  │  ├─ availability/        # *** müsaitlik motoru (saf fonksiyonlar + veri yükleyici) ***
│  │  │  ├─ booking/             # randevu oluşturma/güncelleme/iptal/durum makinesi
│  │  │  ├─ loyalty/             # (sonraki sürüm) puan sistemi
│  │  │  ├─ portfolio/           # yükleme, limit, kategoriler
│  │  │  ├─ customers/           # müşteri hesabı + işletme CRM kaydı
│  │  │  ├─ reviews/
│  │  │  ├─ marketplace/         # arama, filtreleme, öne çıkanlar
│  │  │  └─ admin/               # platform istatistikleri, işletme oluşturma
│  │  ├─ storage/                # Vercel Blob / yerel disk adaptörü, görsel işleme
│  │  └─ lib/                    # AppError, logger, audit log, saat/zaman yardımcıları
│  ├─ components/
│  │  ├─ ui/                     # shadcn temel bileşenler
│  │  ├─ marketplace/  panel/  admin/  shared/
│  ├─ lib/                       # istemci + sunucu ortak: zod şemaları, formatlayıcılar (TL, tarih)
│  └─ middleware.ts              # realm bazlı yönlendirme (gerçek yetki kontrolü sunucuda)
└─ tests/
   ├─ unit/                      # müsaitlik algoritması, puan hesabı
   ├─ integration/               # çakışma, izolasyon, yetki (gerçek DB)
   └─ e2e/                       # Playwright (masaüstü + mobil)
```

**Kural:** `app/` katmanı yalnızca girdiyi alır, oturumu çözer ve modül fonksiyonunu çağırır. İş kuralları yalnızca `server/modules` içinde bulunur.

---

## 3. Veritabanı Tasarımı

Genel kurallar:

- Bütün ID'ler `uuid` (v7, zamana göre sıralı).
- Para tutarları `integer` kuruş cinsinden tutulur (`price_kurus`).
- Zaman damgaları `timestamptz` (UTC). Haftalık saatler `time` + `weekday` (1=Pzt … 7=Paz) olarak, Europe/Istanbul yerel saatiyle yorumlanır.
- İşletmeye ait **her tabloda `business_id`** bulunur. İlişkiler **bileşik yabancı anahtarla** kurulur: örneğin `appointments(business_id, staff_id) → staff(business_id, id)`. Böylece A işletmesinin randevusu B işletmesinin çalışanına **veritabanı seviyesinde** bağlanamaz.
- Silme işlemi gereken yerlerde soft delete (`deleted_at`) yapılır. Geçmiş randevular hizmet/fiyat bilgisinin *anlık görüntüsünü (snapshot)* saklar.

### 3.1 Kimlik ve Oturum

Üç ayrı giriş alanı (realm) **ayrı tablolarda** tutulur. Bir rol alanını değiştirerek yetki yükseltmek mümkün olmaz.

| Tablo | Alanlar | Not |
|---|---|---|
| `platform_admins` | id, email (uniq), password_hash, name, totp_secret (opsiyonel), is_active, last_login_at | Yalnızca platform sahibi. Seed script ile oluşturulur. |
| `business_users` | id, **business_id**, login (uniq, e-posta ya da kullanıcı adı), password_hash, name, must_change_password, is_active, last_login_at | Admin tarafından oluşturulur. Kayıt ekranı yok. **Yalnızca işletme hesabı; çalışan girişi yoktur ve olmayacaktır.** |
| `customers` | id, name, **email (uniq, zorunlu)**, email_verified_at, phone (zorunlu, doğrulanmaz), password_hash, kvkk_consent_at, marketing_consent, deleted_at | Kayıt ve giriş: **e-posta + şifre**. E-posta doğrulama bağlantısı gönderilir. SMS yok. |
| `auth_tokens` | id (hash), realm, principal_id, purpose (`EMAIL_VERIFY`/`PASSWORD_RESET`), expires_at, used_at | E-posta doğrulama ve şifre sıfırlama bağlantıları. |
| `rate_limits` | key, count, window_ends_at | Sabit pencereli sayaçlar. |
| `sessions` | id (= token'ın SHA-256 hash'i), realm (`CUSTOMER`/`BUSINESS`/`ADMIN`), principal_id, expires_at, last_seen_at, ip, user_agent | Token'ın kendisi DB'de saklanmaz. |
| `password_reset_tokens` | id(hash), realm, principal_id, expires_at, used_at | |

### 3.2 Konum ve Platform Sözlükleri

| Tablo | Alanlar |
|---|---|
| `provinces` | id, name, slug (81 il, seed) |
| `districts` | id, province_id → provinces, name, slug (ilçeler, seed) |
| `service_types` | id, name, slug, icon, sort — Platform genelindeki hizmet türleri ("Saç kesimi", "Sakal", "Boya", "Cilt bakımı"…). Pazaryeri filtresi bunlar üzerinden çalışır. Admin yönetir. |
| `public_holidays` | date (pk), name, is_half_day — Resmî tatil listesi, admin yönetir. İşletmeler bu günler için açık/kapalı kararı verir. |

### 3.3 İşletme

| Tablo | Alanlar / Kısıtlar |
|---|---|
| `businesses` | id, **slug (uniq)**, name, description, phone, address_line, province_id, district_id, **latitude, longitude**, logo_key, cover_key, status (`DRAFT`/`ACTIVE`/`SUSPENDED`), is_published, published_at, is_featured, featured_rank, **photo_count (CHECK 0..30)**, rating_avg, rating_count, min_price_kurus (önbellek), created_at, updated_at |
| `business_settings` | business_id (pk), slot_interval_min (vars. 15), min_lead_min (vars. 60), max_advance_days (vars. 30), buffer_min (vars. 0), temp_closed_until (timestamptz, geçici kapanış), temp_closed_note |
| `business_hours` | id, business_id, weekday, start_time, end_time — **Bir gün için birden çok satır = birden çok aralık.** O gün için satır yoksa = kapalı. CHECK(start<end) + aynı gün aralıklar çakışamaz (exclusion). |
| `business_exceptions` | id, business_id, date, kind (`CLOSED`/`CUSTOM_HOURS`), reason (`HOLIDAY`/`SPECIAL`/`VACATION`/`OTHER`), note — uniq(business_id, date) |
| `business_exception_ranges` | id, exception_id, start_time, end_time — Özel gün saatleri. |

### 3.4 Çalışan

| Tablo | Alanlar / Kısıtlar |
|---|---|
| `staff` | id, business_id, name, title, photo_key, bio, is_active, sort_order, deleted_at — uniq(business_id, id) bileşik FK hedefi. Çalışanlar işletme tarafından tanımlanan kayıtlardır; **giriş hesabı yoktur**. |
| `staff_shifts` | id, business_id, staff_id, weekday, start_time, end_time — Haftalık vardiya şablonu. İşletme saatlerinden **ayrı** tutulur. |
| `staff_breaks` | id, business_id, staff_id, weekday, start_time, end_time — Tekrarlayan mola (örn. her gün 13:00–13:45). |
| `staff_time_off` | id, business_id, staff_id, starts_at, ends_at (timestamptz), kind (`LEAVE`/`SICK`/`BLOCK`), note — İzin, rapor ya da tek seferlik blok. |
| `staff_services` | business_id, staff_id, service_id — PK(staff_id, service_id). Çalışanın hizmet verme yetkinliği. |

### 3.5 Hizmet ve Paket

| Tablo | Alanlar |
|---|---|
| `services` | id, business_id, service_type_id → service_types, name, description, price_kurus (≥0), duration_min (>0, 5'in katı), is_active, sort_order, deleted_at |
| `packages` | id, business_id, name, description, price_kurus, duration_min (toplam işlem süresi, düzenlenebilir; varsayılan = içerdiği hizmetlerin toplamı), is_active, deleted_at |
| `package_items` | package_id, service_id, sort_order |
| `package_staff` | business_id, package_id, staff_id — Paketi verebilecek çalışanlar. |

### 3.6 Müşteri ↔ İşletme İlişkisi (CRM)

| Tablo | Alanlar |
|---|---|
| `business_customers` | id, business_id, customer_id (nullable → `customers`), display_name, phone, email, notes (işletmeye özel), first_visit_at, last_visit_at, visit_count — uniq(business_id, customer_id) |

- İşletme, yalnızca **kendisinden randevu almış** müşterileri bu tablo üzerinden görür. `customers` tablosuna doğrudan erişimi olmaz.
- Müşteri notları işletmeye özeldir. Başka işletme ve müşteri bu notları göremez.
- `customer_id` NULL olan kayıtlar, işletmenin panelden manuel girdiği telefonla arayan ya da kapıdan gelen **hesapsız** müşterilerdir (karar verildi). Bu kayıtlar yalnızca panelden oluşturulabilir. Online randevu her zaman üyelik ister.
- Hesapsız müşteri daha sonra aynı telefonla üye olursa, işletme kaydı hesapla eşleştirilebilir.

### 3.7 Randevu

| Tablo | Alanlar / Kısıtlar |
|---|---|
| `appointments` | id, business_id, staff_id, business_customer_id, customer_id (online randevularda dolu), **starts_at, ends_at, blocked_until** (= ends_at + buffer), confirm_deadline, confirmed_at, status (`PENDING`/`CONFIRMED`/`COMPLETED`/`CANCELLED`/`NO_SHOW`), source (`ONLINE`/`PANEL`), total_kurus (bilgi amaçlı; **online ödeme yoktur**), customer_note, internal_note, cancelled_at, cancelled_by_realm, cancel_reason, idempotency_key (uniq), created_at, updated_at |
| `appointment_items` | id, appointment_id, service_id / package_id (biri dolu), name_snapshot, price_snapshot_kurus, duration_snapshot_min |
| `appointment_events` | id, appointment_id, from_status, to_status, actor_realm, actor_id, note, created_at — Denetim izi. |

**Çakışmayı engelleyen veritabanı kısıtı (en kritik satır):**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, blocked_until, '[)') WITH &&
  ) WHERE (status IN ('PENDING','CONFIRMED'));
```

Uygulama katmanında bir hata olsa ya da iki istek aynı milisaniyede gelse bile, aynı çalışana çakışan iki aktif randevu **fiziksel olarak yazılamaz**. İptal edilen randevu bu kısıttan çıkar ve saati otomatik olarak yeniden müsait olur. (Tamamlanan ya da gelmeyen randevular geçmişte kaldığı için kısıta dahil edilmez.)

### 3.8 Portfolyo

| Tablo | Alanlar |
|---|---|
| `portfolio_categories` | id, business_id, name, sort_order |
| `portfolio_photos` | id, business_id, staff_id (nullable), category_id (nullable), storage_key, width, height, size_bytes, mime, caption, sort_order, created_at |

30 fotoğraf limiti, **atomik sayaçla** uygulanır:

```sql
UPDATE businesses SET photo_count = photo_count + 1
 WHERE id = $1 AND photo_count < 30 RETURNING photo_count;
-- satır dönmezse → "Fotoğraf limitiniz doldu (30/30)"
```

Ek güvence olarak `CHECK (photo_count BETWEEN 0 AND 30)` tanımlanır. Silme işlemi sayacı aynı transaction içinde azaltır.

### 3.9 Yorum ve Favori

| Tablo | Alanlar |
|---|---|
| `reviews` | id, business_id, **appointment_id (uniq)**, customer_id, staff_id, rating (1–5), comment, business_reply, replied_at, status (`VISIBLE`/`REMOVED`), removed_by_admin_id, removed_at, removal_reason, created_at — **Yalnızca `COMPLETED` randevu için** ve randevu başına tek yorum. |
| `review_reports` | id, review_id, business_id, reason (`SPAM`/`HAKARET`/`YANILTICI`/`DIGER`), note, status (`OPEN`/`REJECTED`/`REMOVED`), resolved_by_admin_id, resolved_at, admin_note, created_at — İşletmenin şikâyetleri. |
| `favorites` | customer_id, business_id — PK(customer_id, business_id) |

Yorum kuralları (karar verildi):

- İşletme yoruma **yanıt verebilir**, ama yorumu **gizleyemez ya da silemez**.
- İşletme yorumu şikâyet edebilir (yorum başına işletmenin tek açık şikâyeti).
- Şikâyetler admin panelindeki "Yorum Şikâyetleri" kuyruğuna düşer. Admin inceler, ardından yorumu **kaldırır** (`REMOVED`, puan ortalamasından düşülür) ya da şikâyeti **reddeder**. Bu işlemler denetim kaydına yazılır.

### 3.10 Sadakat Puanı (işletme bazlı) — **SONRAKİ SÜRÜM**

> Karar: Puan sistemi v1 kapsamında değildir. Aşağıdaki tasarım ileride uygulanmak üzere saklanmıştır. v1'de bu tablolar oluşturulmaz, ancak randevu modeli puan sistemine engel olmayacak şekilde kurulur.

| Tablo | Alanlar / Kısıtlar |
|---|---|
| `loyalty_settings` | business_id (pk), is_enabled, earn_mode (`PER_TL`/`PER_APPOINTMENT`), earn_rate (numeric; örn. 1 TL = 1 puan ya da randevu başı 50 puan), point_value_kurus (1 puanın TL karşılığı), min_redeem_points, max_redeem_percent (bir randevuda en fazla % kaç indirim yapılabileceği), expiry_days (nullable) |
| `loyalty_accounts` | business_id, customer_id, **balance (CHECK ≥ 0)**, lifetime_earned, lifetime_spent — PK(business_id, customer_id) |
| `loyalty_transactions` | id, business_id, customer_id, appointment_id, type (`EARN`/`REDEEM`/`REFUND`/`ADJUST`/`EXPIRE`), points (işaretli), balance_after, note, actor_realm, actor_id, created_at |

Kısıtlar:

- `UNIQUE (appointment_id) WHERE type='EARN'` → aynı randevudan iki kez puan kazanılamaz.
- `UNIQUE (appointment_id) WHERE type='REDEEM'` ve `… WHERE type='REFUND'`.
- Puan **yalnızca** randevu `COMPLETED` durumuna geçtiğinde, aynı transaction içinde kazanılır. İptal edilen ya da gelinmeyen randevudan puan kazanılmaz.
- Harcama işleminde bakiye atomik olarak kontrol edilir: `UPDATE loyalty_accounts SET balance = balance - $p WHERE … AND balance >= $p`. Satır dönmezse "Yetersiz puan" hatası verilir.
- Bakiye, işlem defterinden (ledger) her zaman yeniden hesaplanabilir. Testler bu tutarlılığı ayrıca doğrular.

### 3.11 Platform

| Tablo | Alanlar |
|---|---|
| `notifications` | id, channel (`EMAIL`), to, template, payload (jsonb), status (`QUEUED`/`SENT`/`FAILED`), attempts, error, related_appointment_id, sent_at, created_at — Gönderim kuyruğu ve kaydı. |
| `business_subscriptions` | id, business_id, plan_name, monthly_fee_kurus, starts_on, ends_on, status (`ACTIVE`/`ENDED`), note — Platformun işletmeden aldığı ücret. **Online tahsilat yok**; admin manuel kaydeder. |
| `subscription_payments` | id, business_id, subscription_id, amount_kurus, paid_on, method (`HAVALE`/`NAKIT`/`DIGER`), period_label (örn. 2026-11), note, recorded_by_admin_id |
| `platform_settings` | key (pk), value (jsonb), updated_by, updated_at — Güven puanı ağırlıkları, onay süresi (6 saat), iptal sınırı (2 saat) gibi kod dışı ayarlar. |
| `audit_logs` | id, actor_realm, actor_id, business_id, action, entity, entity_id, meta (jsonb), ip, created_at — Admin işlemleri, giriş denemeleri, müşteri verisine erişim. |

### 3.11.1 İşletme Güven Puanı

Amaç: Paneline bakmayan, randevuları onaylamayan ya da onayladığı randevuyu iptal eden işletme pazaryerinde aşağıya düşer. Hesaplama sunucuda yapılır; ağırlıklar `platform_settings` içindedir, kodda sabit değildir.

| Tablo | Alanlar |
|---|---|
| `business_trust_scores` | business_id (pk), score (0–100), sample_size, components (jsonb: her bileşenin değeri), computed_at |
| `business_trust_history` | id, business_id, score, components, computed_on (gün) — Günlük geçmiş; panelde grafik ve admin incelemesi için. |
| `businesses.last_panel_activity_at` | İşletme panelinde son anlamlı işlem zamanı (giriş, randevu görüntüleme/işlem). |

Bileşenler (son 30 gün, varsayılan ağırlıklar, admin değiştirebilir):

| Bileşen | Ölçüm | Ağırlık |
|---|---|---|
| Onay oranı | Bekleyen talepler içinde işletmenin karar verdiği (onay/ret) oran. **Süre dolup otomatik iptal olan her talep en ağır cezadır.** | %40 |
| Yanıt hızı | Talep → onay/ret arasındaki medyan süre (≤30 dk tam puan, 6 saate doğru azalır) | %20 |
| İşletme kaynaklı iptal | Onaylanmış randevuyu sonradan işletmenin iptal etme oranı | %20 |
| Randevu sonuçlandırma | Saati geçmiş onaylı randevuların "Tamamlandı / Gelmedi" olarak işaretlenme oranı | %10 |
| Panel aktivitesi | Son panel aktivitesinden bu yana geçen gün (≤1 gün tam puan, 14+ gün sıfır) | %10 |

- **Yeni işletme:** Az veriyle haksız ceza olmasın diye puan, nötr bir başlangıç değerine (70) doğru yumuşatılır (Bayesçi ortalama, örn. en az 10 talep sonrası tamamen kendi verisi).
- **Ne zaman hesaplanır:** Her randevu olayında ilgili işletme için yeniden ve ayrıca günlük toplu hesaplama (Vercel Cron).
- **Sıralamaya etkisi:** Pazaryerinde varsayılan "Önerilen" sıralama = güven puanı + Bayesçi yorum puanı + (konum varsa) uzaklık + bugün müsaitlik bileşiminden oluşur. Güven puanı belirli bir eşiğin (örn. 40) altındaki işletmeler "Öne çıkanlar" ve "Bugün müsait" vitrinlerine giremez.
- **Görünürlük:** İşletme kendi puanını ve **hangi bileşenden puan kaybettiğini** panelde görür (örn. "Son 30 günde 3 randevu onaylanmadan iptal oldu"). Admin tüm işletmelerin puanını ve geçmişini görür. Müşteri sayıyı görmez; yalnızca olumlu rozetler gösterilir (örn. "Hızlı onaylar").

### 3.12 İlişki Özeti

```
provinces 1─* districts 1─* businesses
businesses 1─1 business_settings, loyalty_settings
businesses 1─* business_hours, business_exceptions 1─* business_exception_ranges
businesses 1─* business_users
businesses 1─* staff 1─* staff_shifts / staff_breaks / staff_time_off
businesses 1─* services *─* staff            (staff_services)
businesses 1─* packages *─* services         (package_items)
                packages *─* staff            (package_staff)
service_types 1─* services
businesses 1─* business_customers *─1 customers (nullable)
businesses 1─* appointments 1─* appointment_items, appointment_events
appointments *─1 staff, *─1 business_customers
appointments 1─0..1 reviews
businesses 1─* portfolio_categories 1─* portfolio_photos *─0..1 staff
customers *─* businesses  (favorites)
(business, customer) 1─1 loyalty_accounts 1─* loyalty_transactions *─0..1 appointments
```

---

## 4. Üç Panelin Mimarisi

Üç panel **aynı uygulama, aynı backend ve aynı veritabanını** kullanır. Ayrım, *realm* bazlı oturumla yapılır.

| | Müşteri / Pazaryeri | İşletme Paneli | Süper Admin |
|---|---|---|---|
| URL | `/`, `/ara`, `/berber/[slug]`, `/giris`, `/kayit`, `/hesabim/*` | `/isletme/giris[/slug]`, `/isletme/panel/*` | `/admin/giris`, `/admin/*` |
| Oturum çerezi | `bp_c` | `bp_b` (path=/isletme) | `bp_a` (path=/admin, daha kısa ömür, opsiyonel 2FA) |
| Guard | `requireCustomer()` | `requireBusiness()` → `{ businessId, userId }` | `requireAdmin()` |
| Kapsam | Herkese açık okuma + kendi verisi | **Yalnızca kendi `businessId`'si** | Tüm platform |

Örnek akış: `İstek → middleware (realm'e göre yönlendirme, kolaylık amaçlı) → Route/Action → guard (asıl yetki) → Zod doğrulama → modül servisi (ctx.businessId ile) → DB`

**İşletme bağlamı kuralı:** İşletme paneli API'lerinde `businessId` **hiçbir zaman istek gövdesinden ya da URL'den alınmaz**. Her zaman oturumdan gelir. Modül fonksiyonları zorunlu olarak `ctx: BusinessContext` parametresi alır, ve sorgular bu parametre olmadan derlenmez (tip seviyesinde zorlanır).

**İşletme paneli menüsü:** Genel Bakış · Takvim · Randevular · Çalışanlar · Hizmetler · Paketler · Çalışma Saatleri · Portfolyo (18/30) · Müşteriler · Yorumlar · İşletme Profili · Ayarlar

**Admin menüsü:** Gösterge Paneli · İşletmeler (oluştur / düzenle / yayınla / askıya al / giriş bilgisi tanımla / şifre sıfırla / güven puanı) · Yorum Şikâyetleri · Abonelikler & Ödemeler · Raporlar (randevu cirosu, abonelik geliri) · Platform Ayarları · Hizmet Türleri · Resmî Tatiller · Denetim Kayıtları

**İşletmeye özel giriş bağlantısı:** `/isletme/giris/[slug]` adresi işletmenin logosunu ve adını gösterir. Giriş bilgileri yine kontrol edilir; bağlantı bir yetki vermez, yalnızca kolaylık sağlar. İlk girişte şifre değiştirme zorunludur.

**Açık/Kapalı durumu:** `getBusinessOpenState(business, now)` fonksiyonu sırasıyla geçici kapanış → istisna günü (tatil/özel gün) → haftalık saatler kontrolüne bakar ve `{ isOpen, closesAt | opensAt }` döner. Sunucuda hesaplanır, hiçbir yerde elle "açık" bayrağı tutulmaz.

---

## 5. Müsaitlik ve Randevu Algoritması

### 5.1 Girdi

`businessId`, seçim (bir ya da daha fazla hizmet **veya** bir paket), opsiyonel `staffId`, `date` (yerel gün).

### 5.2 Süre ve aday çalışanlar

- **Süre (D):** paket ise `packages.duration_min`, hizmet(ler) ise süreleri toplamı.
- **Aday çalışanlar:** aktif ve seçilen **tüm** hizmetlere `staff_services` üzerinden yetkin olanlar (paket ise `package_staff` listesindekiler). Müşteri çalışan seçtiyse aday listesi yalnızca o çalışandır ve yetkinliği yine doğrulanır.

### 5.3 Gün için işletme pencereleri (W)

1. `temp_closed_until` o güne denk geliyorsa → boş.
2. `business_exceptions[date]` varsa: `CLOSED` → boş, `CUSTOM_HOURS` → o aralıklar.
3. Yoksa `business_hours[weekday]` aralıkları (satır yoksa → kapalı).

### 5.4 Her aday çalışan için boş aralıklar

```
çalışma  = staff_shifts[weekday]  ∩  W
meşgul   = staff_breaks[weekday]
         ∪ staff_time_off (o güne düşen kısım)
         ∪ aktif randevular [starts_at, blocked_until)   (PENDING/CONFIRMED)
boş      = çalışma − meşgul      (aralık cebiri, dakika hassasiyetinde)
```

### 5.5 Slot üretimi

Her boş aralık için başlangıç zamanları `slot_interval_min` ızgarasında taranır (örn. 09:00, 09:15, …). Bir `t` başlangıcı şu koşulları sağlıyorsa geçerli sayılır:

- `t + D + buffer ≤ aralık sonu`
- `t ≥ şimdi + min_lead_min`
- `tarih ≤ bugün + max_advance_days`

Çalışan seçilmemişse slotlar birleştirilir. Her slot için `{ saat, uygunÇalışanlar[] }` döner.

### 5.6 Randevu oluşturma (atomik)

1. `requireCustomer()`: oturum yoksa **401**. Misafir için alternatif endpoint **yoktur**.
2. Zod doğrulaması ve rate limit uygulanır. `Idempotency-Key` ile çift tıklama ya da tekrar gönderim engellenir.
3. `BEGIN` → hizmet/paket fiyat ve süreleri **DB'den** yeniden okunur (istemciden gelen fiyat ya da süreye asla güvenilmez). Seçilen slot, aynı algoritmayla o çalışan için **yeniden doğrulanır**.
4. Çalışan "fark etmez" seçildiyse adaylar sıralanır (o gün en az randevusu olan önce gelir) ve sırayla denenir.
5. `INSERT appointments …`. Postgres **exclusion constraint** çakışmada `23P01` hatası döner. Bu durumda sıradaki aday denenir. Hiçbir aday kalmazsa **409 "Bu saat az önce doldu"** hatası ve en yakın alternatif saatler döner.
6. `business_customers` kaydı upsert edilir, `appointment_events` yazılır → `COMMIT`.
7. Durum: **Online randevu her zaman `PENDING` (Bekliyor)** olarak oluşur ve işletme onaylar. Onay son tarihi `confirm_deadline = min(oluşturma + 6 saat, randevu başlangıcı)` olarak kaydedilir. `PENDING` randevu da slotu bloke eder, yani aynı saate ikinci bir talep yapılamaz. İşletmenin panelden kendi oluşturduğu randevu doğrudan `CONFIRMED` olur (işletme zaten onaylamış sayılır).

### 5.7 Durum makinesi

```
PENDING  → CONFIRMED | CANCELLED
CONFIRMED→ COMPLETED | CANCELLED | NO_SHOW
COMPLETED, CANCELLED, NO_SHOW → (son durum)
```

- Müşteri, randevu saatine **2 saat kalana kadar** kendi randevusunu iptal edebilir ya da değiştirebilir (platform kuralı, sunucuda uygulanır). Değiştirme = aynı transaction'da yeni slotu doğrula + güncelle; exclusion constraint burada da korur. Değiştirilen online randevu yeniden `PENDING` olur.
- İşletme randevuyu her zaman onaylayabilir, reddedebilir/iptal edebilir, düzenleyebilir ve durumunu güncelleyebilir.
- İptal edilen randevunun slotu otomatik olarak serbest kalır.
- **Onaylanmayan talep:** `confirm_deadline` geçen `PENDING` randevu otomatik olarak `CANCELLED` (neden: `ISLETME_ONAYLAMADI`) olur, müşteriye e-posta gider ve işletmenin güven puanı düşer. Bu iki yolla garanti edilir: (1) Vercel Cron birkaç dakikada bir süresi dolanları iptal eder; (2) yeni randevu transaction'ı, ilgili çalışanın süresi dolmuş bekleyenlerini önce iptal eder. Böylece cron gecikse bile süresi dolmuş bir talep saati kapatmaya devam etmez.

### 5.7.1 Bildirimler (e-posta)

Randevu talebi alındı · onaylandı · reddedildi / iptal edildi · onay süresi doldu · değiştirildi · hatırlatma (randevudan 1 gün önce). İşletmeye: yeni talep e-postası. Gönderim `notifications` kuyruğu üzerinden yapılır, randevu transaction'ını bekletmez. Sağlayıcı: Resend (ya da eşdeğeri), sağlayıcıdan bağımsız arayüz arkasında.

### 5.8 "Gerçek zamanlı" görünüm

- Slotlar her seçim değişikliğinde sunucudan taze çekilir (önbelleksiz ya da ≤30 sn önbellekli). Kesin kontrol her zaman 5.6'daki transaction'dır.
- Pazaryerinde "Bugün müsait" ve "en yakın boş saat" bilgisi, listelenen sayfadaki işletmeler (sayfa başına ~20) için hesaplanır ve kısa süre önbelleklenir.
- İşletme takvimi periyodik yenileme (polling) ile güncellenir. Gerçek zamanlı push (SSE) bir sonraki sürümde eklenebilir.

### 5.9 Giriş sonrası seçimin korunması

Randevu sihirbazının tüm seçimi URL'de tutulur: `/berber/[slug]/randevu?h=…&p=…&c=…&t=2026-11-22&s=14:30`. Misafir kullanıcı "Onayla"ya bastığında `/giris?next=<bu URL>` adresine yönlendirilir. Giriş ya da kayıt sonrasında aynı adrese geri dönülür ve seçimler eksiksiz geri yüklenir. Bu sırada slot dolduysa kullanıcı uyarılır ve alternatif saatler gösterilir. `next` parametresi yalnızca site içi yolları kabul eder (open-redirect koruması).

---

## 6. Güvenlik ve Yetkilendirme Modeli

| Konu | Uygulama |
|---|---|
| Şifreler | Argon2id (OWASP parametreleri), en az 8 karakter + sızdırılmış/zayıf şifre listesi kontrolü |
| Oturum | 256-bit rastgele token, DB'de yalnızca SHA-256 hash'i saklanır. Çerez `HttpOnly; Secure; SameSite=Lax`, realm başına ayrı çerez. Girişte token yenilenir. Boşta kalma ve mutlak süre sınırı vardır. Çıkış ve şifre değişiminde tüm oturumlar iptal edilebilir. |
| Admin | Ayrı tablo, ayrı çerez, kısa oturum süresi, TOTP 2FA (önerilir), tüm işlemler denetim kaydına yazılır |
| Rol / realm kontrolü | Her endpoint ve server action guard ile başlar. Middleware yalnızca yönlendirme yapar, güvenlik sınırı değildir. |
| İşletme izolasyonu | (1) `businessId` her zaman oturumdan alınır. (2) Bütün sorgular `ctx.businessId` ile filtrelenir. (3) Bileşik FK'ler çapraz işletme ilişkisini DB'de engeller. (4) Entegrasyon testleri izolasyonu ayrıca doğrular. *(İleride ek savunma katmanı olarak PostgreSQL RLS eklenebilir.)* |
| Çakışma | Exclusion constraint + transaction + idempotency key |
| Girdi doğrulama | Zod ile tüm gövde, parametre ve sorgu değerleri doğrulanır. Sorgular parametreli yazılır (Drizzle). Kullanıcı metinleri render sırasında escape edilir. |
| CSRF | SameSite çerez + değişiklik yapan isteklerde `Origin` başlığı kontrolü (server action'lar bunu yerleşik olarak yapar) |
| Rate limiting (PostgreSQL) | Giriş: IP ve hesap başına (örn. 5 deneme / 15 dk, kademeli bekleme). Kayıt, şifre sıfırlama, randevu oluşturma, yükleme ve arama için ayrı limitler. |
| Dosya yükleme | Yalnızca JPEG/PNG/WebP/HEIC kabul edilir. Gerçek tip uzantıdan değil, magic byte'tan anlaşılır. En fazla ~8 MB. sharp ile yeniden kodlanır (WebP, EXIF/GPS temizlenir) ve boyutlandırılır. Rastgele anahtar kullanılır. 30 limiti atomik sayaçla uygulanır. |
| KVKK | Açık rıza ve aydınlatma metni onayı, veri minimizasyonu. İşletme yalnızca kendi müşterisini görür. Müşteri verisine erişim loglanır. Hesap silme ve anonimleştirme sunulur. |
| Hata yönetimi | `AppError(code, httpStatus, kullanıcıMesajı)` → merkezi handler Türkçe mesaj döner, iç detay ve stack trace sızdırılmaz. Loglar pino ile tutulur, PII maskelenir. |
| HTTP başlıkları | CSP (dış betik/çerçeve/form hedefi yasak, görseller yalnızca bilinen kaynaklardan), HSTS, X-Frame-Options/frame-ancestors, COOP, Referrer-Policy, Permissions-Policy. Next.js satır içi betikleri için `script-src 'unsafe-inline'` gerekir (nonce tüm sayfaları dinamik yapar). |
| Bağımlılıklar | `npm audit --omit=dev` canlı bağımlılıklarda 0 açık olmalı (geliştirme aracı drizzle-kit'in esbuild uyarısı canlıya gitmez). |

---

## 7. Geliştirme Aşamaları

*Sadakat puanı sistemi v1 sonrasına ertelendi; ayrı bir aşama olarak eklenecek.*

Her aşamanın sonunda: yapılanlar, eksikler ve test sonuçları raporlanır, onay alınmadan sonraki aşamaya geçilmez.

| Aşama | Teslimatlar | Testler |
|---|---|---|
| **1 — Analiz & Mimari** | Bu doküman, açık soruların yanıtlanması | — |
| **2 — Temel altyapı** | Next.js + TS + Tailwind iskeleti, Docker Compose, Drizzle şeması + migration (exclusion constraint dahil), seed (il/ilçe, hizmet türleri, ilk admin), oturum/realm sistemi, guard'lar, rate limit, AppError, audit log. **Admin paneli:** giriş, işletme oluşturma/düzenleme/yayınlama/askıya alma, işletme kullanıcısı tanımlama, temel istatistikler | Realm izolasyonu, şifre hash, rate limit |
| **3 — İşletme paneli** | Giriş (+özel bağlantı, ilk şifre değişimi), işletme profili, çalışma saatleri (çoklu aralık, istisna, tatil, geçici kapanış), otomatik açık/kapalı, çalışanlar (vardiya, mola, izin, yetkinlik), hizmetler, paketler, portfolyo (S3, 30 limiti, kategori, çalışan bağı) | İşletmeler arası izolasyon, foto limiti eşzamanlılık testi |
| **4 — Randevu sistemi** | Müsaitlik motoru, randevu oluşturma/düzenleme/iptal, durum makinesi, onay süresi + otomatik iptal (cron), e-posta bildirimleri, güven puanı hesaplama, panel takvimi (gün/hafta/ay, çalışan bazlı), panelden randevu ekleme, müşteri CRM kaydı, genel bakış metrikleri | **Eşzamanlı çakışma testi** (N paralel istek → tam 1 başarı), algoritma birim testleri (mola, izin, paket, buffer, sınırlar) |
| **5 — Müşteri pazaryeri** | Ana sayfa, arama + filtreler (il/ilçe, fiyat, puan, hizmet türü, bugün müsait, konuma yakınlık), öne çıkan/popüler, berber profili, galeri, harita, randevu sihirbazı (giriş sonrası seçim koruma), müşteri hesabı (randevularım, geçmiş, favoriler, ayarlar), yorumlar | E2E randevu akışı, misafir → giriş → seçim korunması, 401 testi |
| **6 — Test & güvenlik** | Yetki matrisi testleri, IDOR taraması, mobil/tablet görünüm testleri (Playwright cihaz profilleri), form/API doğrulama testleri, güvenlik başlıkları, performans kontrolü, PWA hazırlığı (manifest, ikon, offline sayfası) | Tam test raporu |

---

## 8. Kararlar

| # | Konu | Karar |
|---|---|---|
| 1 | Barındırma | **Vercel** (+ Neon Postgres, Vercel Blob; Frankfurt bölgesi). Hedef: tamamen ücretsiz katmanlar. Not: Vercel Hobby planı ticari kullanıma izin vermez; gelir elde edilmeye başlanınca Pro plan gerekir. |
| 3 | Randevu ilk durumu | Online randevu **Bekliyor** olarak oluşur, işletme onaylar. Panelden girilen randevu doğrudan Onaylandı. |
| 4 | Ödeme | **Online ödeme hiçbir şekilde olmayacak.** Ödeme işletmede yapılır. |
| 6 | Panelden randevu | İşletme, telefonla arayan ya da kapıdan gelen **hesapsız** müşteriye panelden randevu girebilir. Online kanal yalnızca üyelere açık. |
| 7 | İşletme hesapları | Yalnızca işletme hesabı. **Çalışan girişi kesinlikle yok**; çalışanları işletme tanımlar. |
| 8 | İptal / değişiklik | Müşteri randevuya **2 saat** kalana kadar iptal ya da değişiklik yapabilir. |
| 10 | Harita | **OpenStreetMap + Leaflet** (ücretsiz) |
| 11 | Çoklu hizmet | Evet. Süreler toplanır, tek çalışan yapar. |
| 12 | Paket | Paketin tamamını **tek çalışan** yapar. |
| 13 | Yorumlar | İşletme yanıt verebilir, **gizleyemez**. İşletme şikâyet eder; admin inceler ve silebilir. |
| 14 | Sadakat puanı | **v1 kapsamı dışında**, sonra geliştirilecek. |
| 2 | Müşteri hesabı | **E-posta + şifre**, e-posta doğrulamalı. **SMS doğrulaması yok** (ücretsiz ilerleme kararı). Telefon iletişim için alınır. |
| 5 | Gelir takibi | **İkisi de:** işletmelerin tamamlanan randevu cirosu + platformun işletmelerden aldığı abonelik ücretlerinin admin tarafından manuel kaydı. |
| 9 | Bildirim | **Ekran + e-posta.** WhatsApp/SMS bildirimi yok. |
| 15 | Onaylanmayan talep | **6 saat** içinde onaylanmazsa (ya da randevu saati daha yakınsa o saate kadar) otomatik iptal. |
| 17 | Giriş adresleri | Yönetici: **/admin** (oturum yoksa giriş ekranı). İşletme: **/isletme**, işletmeye özel: **/isletme/<isletme-adi>**. Eski /admin/giris ve /isletme/giris yönlendirilir. Alan adı henüz yok; tüm adresler göreli. |
| 18 | Ana sayfa bannerı | Admin panelinden yönetilir: görsel, başlık, alt başlık, buton/bağlantı, sıra, aktiflik, yayın başlangıç/bitiş. |
| 19 | Abonelik | Paketler veritabanında (bugün: Standart 699,90 TL/ay veya 6.990 TL/yıl; Premium Plus vb. panelden eklenir, `capabilities` alanı pakete özel yetkiler için ayrılmıştır). Kampanya: ilk 20 işletme 3 ay, sonrakiler 1 ay ücretsiz (değerler ayar). **Ücretlendirme anahtarı** kapalıyken herkes ücretsiz, kart bilgisi istenmez; açıldığı gün deneme süreleri başlar. Ödeme kaydı kartla online ödemeye hazır (method CARD, provider, provider_ref); sağlayıcı şirket kurulunca bağlanacak. Gecikmede otomatik askıya alma yok. |
| 20 | Tasarım dili | Göz yormayan, minimalist: sıcak nötr (stone) zemin, mürekkep ana renk, ölçülü pirinç vurgu, açık kenar çubuğu. |
| 21 | Ödeme gecikmesi | Günlük kontrol (Vercel Cron, 09:00 TR). Gecikmenin **ilk günü** işletmeye ve yöneticiye e-posta (her gecikme dönemi için bir kez). **7. gün** (ayarlanabilir) otomatik askıya alma + e-posta. Ödeme kaydedilince ödeme nedeniyle askıya alınan işletme otomatik açılır ve önceden yayındaysa yeniden yayına alınır. Yöneticinin elle askıya aldığı işletme ödemeyle açılmaz. |
| 22 | Kart aboneliği | Ücretlendirme açıldığında aylık ücret **otomatik yenilenen kart aboneliği** ile çekilecek (işletme kartı bir kez tanımlar). Kart bilgisi platform veritabanında **asla** tutulmaz; sağlayıcının kasasında saklanır, biz yalnızca sağlayıcı referanslarını ve kartın son 4 hanesini tutarız. Sağlayıcıdan gelen başarılı çekim olayı ödeme kaydına dönüşür (çift kayıt engelli); başarısız çekim gecikme akışını tetikler. Sağlayıcı bağlantısı (`PaymentGateway` arayüzü) şirket kurulunca yapılacak. |
| 23 | İşletme profili | İşletme profil bilgilerini (ad, adres, konum, telefon, e-posta, tanıtım, logo, kapak) **değiştiremez**; yalnızca platform yönetimi değiştirir. İşletme panelinde salt okunur gösterilir ve platform iletişim bilgileri yer alır. Çalışma saatleri, çalışanlar, hizmetler, paketler ve portfolyoyu işletme yönetir. |
| 24 | Abonelik yönetimi (işletme) | İşletme panelinde Abonelik sayfası: paket/durum, **ödeme yöntemi değişikliği** (kartla otomatik ödeme ↔ havale/EFT; karttan havaleye geçişte sağlayıcıdaki otomatik çekim iptal edilir), **kart tanımlama/değiştirme** (sağlayıcının güvenli sayfasında; sağlayıcı bağlanana dek pasif), ödeme geçmişi ve faturalar. Çalışma saatleri, çalışanlar, hizmetler, paketler, portfolyo işletmededir. |
| 25 | Faturalar | Her otomatik (kartla) ödemede yöneticiye "ödeme alındı, fatura yükleyin" e-postası. Admin "Faturası bekleyen ödemeler" listesinden PDF yükler (içerik kontrolü). Fatura herkese açık bağlantıyla verilmez; yalnızca ilgili işletme ve yönetici oturumuyla indirilir. Yükleme işletmenin bildirim kutusuna düşer. |
| 26 | Belgelerim | İşletme yasal belgelerini (vergi levhası, işyeri açma ve çalışma ruhsatı; türler admin tarafından yönetilir) PDF/JPEG/PNG yükler. Admin onaylar ya da gerekçeyle reddeder; sonuç bildirim + e-posta. **Zorunlu belgeleri onaylanmayan işletme yayına alınamaz.** Belgeler gizlidir (yalnızca işletme ve yönetici). Görsellerden konum vb. metadata silinir. |
| 27 | Sözleşmeler | Admin sözleşme oluşturur ve sürüm yayınlar (yayınlanan sürüm değişmez). Her yayında işletmelere bildirim + e-posta: "güncellendi, göz atıp onaylayın"; onaylanana dek panelde uyarı. Onaylar tarih/IP/tarayıcı ile kaydedilir; admin kimin onayladığını görür. **Güncel sözleşmeleri onaylamayan işletme yayına alınamaz**; yayındaki işletme yeni sürümde yayından kaldırılmaz. |
| 28 | Bildirimler | İşletme panelinde okunmamış sayılı bildirim kutusu (sözleşme, belge sonucu, fatura, ödeme). |
| 29 | Ödeme penceresi | Ücretsiz süresi biten, kartla otomatik ödemesi kurulmamış ve dönemi ödenmemiş işletmenin panelinde **kapatılamayan** uyarı penceresi: "Ücretsiz deneme/kullanım süreniz sona erdi — lütfen kart bilgilerinizi girin; bu aydan itibaren aylık/yıllık X TL" (seçili ödeme dönemine göre). Abonelik sayfasında pencere yerine sabit uyarı (kart girilebilsin diye). |
| 30 | Ayın İşletmesi (Aşama 5) | Ay içindeki müşteri yorumlarının yıldız ortalamasına (minimum yorum sayısı + ağırlıklı ortalama) göre sıralama; admin kazananı onaylar; profilde rozet. |
| 31 | Müşteri hesabı | E-posta + şifre; e-posta doğrulaması **randevu almak için zorunlu**. Oturum 30 gün açık kalır, kullanıldıkça uzar. Şifre sıfırlama e-postayla. Hesap silme: yaklaşan randevu yoksa, kişisel veriler anonimleştirilir. |
| 32 | Pazaryeri | Herkese açık: ana sayfa (banner, arama, hizmet türleri, bugün müsait, öne çıkan, popüler), arama (il/ilçe, hizmet, fiyat, puan, bugün müsait, konum), profil, galeri, yorumlar. Yalnızca aktif + yayındaki işletmeler görünür. Vitrinlere (öne çıkan, bugün müsait) güven puanı eşiğin altındakiler giremez. |
| 33 | Online randevu | Sihirbaz seçimleri adres çubuğunda tutar; misafir giriş/kayıt sonrası aynı seçimlere döner. Randevu yalnızca giriş yapmış ve e-postası doğrulanmış müşteriyle oluşturulabilir (başka yol yok). |
| 34 | Yorumlar | Yalnızca tamamlanmış randevuya, bir kez, 60 gün içinde. Profilde ad kısaltılır (Ahmet Y.). İşletme yanıtlar/şikâyet eder; admin kaldırır ya da reddeder. Ayın İşletmesi: ay içinde ≥10 yorum, güven ≥40, ağırlıklı ortalama; admin onaylar; profilde rozet. |
| 16 | Güven puanı | İşletmenin onaylama, yanıt hızı, iptal ve panel aktivitesi davranışından hesaplanır; pazaryeri sıralamasını etkiler (§3.11.1). |
| 35 | Ödeme dönemi | Paketlerin aylık ve (isteğe bağlı) yıllık fiyatı vardır; yıllık fiyatı boş paket yalnızca aylık sunar. İşletme Abonelik sayfasından aylık/yıllık seçer; değişiklik bir sonraki ödemeden itibaren geçerlidir, kartlı abonelik sağlayıcıda da güncellenir. Her iki ücret işletme oluşturulurken kilitlenir; admin işletmeye özel aylık/yıllık ücret verebilir. Yıllık ödeme 12 ay kapsar. |
| 36 | PWA | Kurulabilir uygulama (manifest, ikonlar, Apple ikonu). Service worker yalnızca değişmez derleme dosyalarını ve ikonları önbelleğe alır; sayfalar ve kişisel veri **önbelleğe alınmaz** (paylaşılan cihaz güvenliği, güncel müsaitlik). Bağlantı yoksa çevrimdışı sayfası. Push bildirimleri v1 dışında. |
| 37 | Test kapsamı (Aşama 6) | HTTP güvenlik testleri (başlıklar, yetkisiz/çapraz rol erişim, dizin dışına çıkma, cron, dış kaynaklı server action, CSP ihlali), axe-core ile WCAG 2.1 AA taraması ve yatay taşma kontrolü (masaüstü, tablet, mobil), PWA testleri. |
| 38 | Reklam alanları | Bannerların gösterim yeri: **Üst banner** (ana sayfa en üst) ya da **Liste arası reklam** (ana sayfada bölümlerin arasında, aramada her 6 sonuçtan sonra). İsteğe bağlı il hedefi (yalnızca o ildeki ziyaretçi görür; il bilinmiyorsa yalnızca hedefsizler). "Reklam" etiketiyle açıkça ayrılır, `rel="sponsored"`. Her reklam sayfada en fazla bir kez; alan sayısından fazla reklam varsa saat başı döner. Tıklamalar `/r/<id>` üzerinden sayılır (aynı IP'den 6 saatte bir sayılır), yönetimde görünür. |
| 39 | Konuma göre öneri | Ana sayfada "Yakınındaki berberler" (50 km, mesafeye göre, güven eşiği uygulanır). Konum kaynağı: (1) ziyaretçinin izinle paylaştığı konum — yalnızca kendi tarayıcısındaki çerezde, ~100 m hassasiyetle, 30 gün; sunucuda saklanmaz, "Konumu unut" ile silinir; (2) yoksa Vercel'in IP'ye göre şehir düzeyindeki yaklaşık konumu (izin gerektirmez). Aramada il/konum seçilmemişse ziyaretçi konumu öneri sırasına ve mesafe gösterimine katılır. |
| 40 | Belgeler ve yayın | Zorunlu belgeler işletmenin panelinde "yayına hazırlık" listesinde eksik olarak görünür; ancak yayına alma kararı yöneticidedir, eksik belge yöneticiyi **engellemez** (uyarı gösterilir). Çalışma saati, çalışan, hizmet, konum ve sözleşme onayı engellemeye devam eder. |
| 41 | Adresten konum | Yönetici işletme formunda il/ilçe ve açık adres girilince konum otomatik bulunur (OpenStreetMap Nominatim, ücretsiz; sunucudan, yönetici başına dakikada 20 istek). Tam adres bulunamazsa sadeleştirilmiş adres, o da yoksa ilçe merkezi işaretlenir ve yöneticiden düzeltmesi istenir. Elle seçilmiş konumun üzerine otomatik yazılmaz. |
| 42 | Dükkan fotoğrafları | Kesim fotoğraflarından (portfolyo) ayrı: dış cephe ve iç mekân, en fazla 20. Hem yönetici (işletme detayı) hem işletme (Dükkan Fotoğrafları sayfası) ekler, siler, türünü değiştirir ve sıralar; kimin yüklediği ve tüm işlemler denetim kaydına yazılır. Profilde "Dükkan" bölümünde, dış/iç filtreli galeri olarak gösterilir. |
| 43 | SEO | Kök adres APP_URL (canlıda https://www.dijitalberber.com). Her sayfada tek resmi adres (canonical), Türkçe Open Graph etiketleri ve paylaşım görseli (/og.png). Yerel arama için şehir/ilçe sayfaları: /berberler/[il] ve /berberler/[il]/[ilce] (berberi olmayanlar dizine eklenmez). Yapılandırılmış veri: ana sayfada WebSite + site içi arama ve Organization; profilde HairSalon (adres, konum, puan, çalışma saatleri, fiyatlar) + BreadcrumbList; şehir sayfalarında ItemList. Filtreli arama sonuçları noindex. Site haritasında profiller, şehir/ilçe sayfaları ve başvuru sayfası. Google Search Console doğrulaması GOOGLE_SITE_VERIFICATION ortam değişkeniyle. |
| 44 | İşletme başvurusu | Ana sayfada ve üst menüde "İşletmeni ekle" → /basvuru: işletme ve iletişim bilgileri, il/ilçe, çalışan sayısı, paket ve aylık/yıllık seçimi, KVKK onayı. Bot tuzağı alanı, IP başına saatte 3 başvuru, aynı telefon/e-postayla bekleyen başvuru tekrarlanamaz. Yöneticiye ve başvurana e-posta gider. Yönetici "Başvurular" sayfasından onaylar: işletme + hesap oluşur, seçilen paket ve dönem işlenir, ücretsiz süre **onay sırasına** göre kampanya kuralıyla verilir (ilk N işletmeye 3 ay, sonrakilere 1 ay), giriş bilgileri e-postayla gönderilir. |
