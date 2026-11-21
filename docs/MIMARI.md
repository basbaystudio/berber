# Berber Pazaryeri ve Randevu Platformu — Mimari Doküman (Aşama 1)

> Durum: **Taslak — onay bekliyor.** Bu doküman onaylanmadan kod geliştirmesine başlanmayacaktır.
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
| Veritabanı | **PostgreSQL 16+ (+ PostGIS, btree_gist, pg_trgm, unaccent)** | Randevu çakışmasını **veritabanı seviyesinde** engelleyen *exclusion constraint*, konum sorguları, Türkçe metin araması ve sağlam transaction desteği. |
| ORM | **Drizzle ORM + drizzle-kit migration** | SQL'e yakın, tip güvenli ve hafif. `tstzrange`, exclusion constraint ve `FOR UPDATE` gibi ileri SQL özelliklerini rahatça kullanmaya izin veriyor. |
| Doğrulama | **Zod** | Aynı şema hem formda hem API'de kullanılır. Backend doğrulaması her zaman zorunlu. |
| Kimlik doğrulama | **Kendi oturum katmanımız** (opak token + DB oturumu, **Argon2id** hash) | Üç ayrı giriş alanını (müşteri / işletme / admin) katı şekilde ayırmak, hazır kütüphanelerle zorlama ve sızıntıya açık olurdu. Kod küçük ve denetlenebilir kalıyor. |
| Dosya depolama | **S3 uyumlu nesne depolama** (Cloudflare R2 / AWS S3 / MinIO) + **sharp** | Fotoğraf sunucuda doğrulanır, WebP'ye dönüştürülür ve EXIF temizlenir. Veritabanında yalnızca anahtar/URL ve metadata tutulur. |
| Önbellek / Rate limit | **Redis** (yönetilen ya da self-host) | Rate limiting ve müsaitlik önbelleği için. |
| UI | **Tailwind CSS + shadcn/ui (Radix)**, ikonlar: lucide | Erişilebilir, sade ve tutarlı bileşenler. |
| Takvim | Kendi geliştirdiğimiz gün / hafta / ay görünümü (çalışan sütunlu) | FullCalendar'ın çalışan sütunlu (resource) görünümleri ücretli lisans istiyor. |
| Grafik | Recharts | Panel istatistikleri için. |
| Harita | Leaflet + OpenStreetMap *(ya da Google Maps — bkz. Sorular)* | |
| Tarih/saat | `date-fns` + `@date-fns/tz` | Tüm hesaplamalar Europe/Istanbul'da yapılır, DB'de `timestamptz` (UTC) tutulur. |
| Test | **Vitest** (birim + entegrasyon, gerçek Postgres ile), **Playwright** (E2E + mobil görünüm) | Çakışma testleri gerçek veritabanında, eşzamanlı isteklerle koşturulur. |
| Loglama / hata | pino + merkezi `AppError` yapısı, isteğe bağlı Sentry | |
| Geliştirme ortamı | Docker Compose (Postgres + Redis + MinIO) | |

---

## 2. Proje Klasör Yapısı

```
berber/
├─ docs/                         # Mimari, karar kayıtları
├─ docker-compose.yml            # postgres(postgis), redis, minio
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
│  │  │  ├─ loyalty/             # puan hesabı, kazanma, harcama, geçmiş
│  │  │  ├─ portfolio/           # yükleme, limit, kategoriler
│  │  │  ├─ customers/           # müşteri hesabı + işletme CRM kaydı
│  │  │  ├─ reviews/
│  │  │  ├─ marketplace/         # arama, filtreleme, öne çıkanlar
│  │  │  └─ admin/               # platform istatistikleri, işletme oluşturma
│  │  ├─ storage/                # S3 istemcisi, görsel işleme
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
| `business_users` | id, **business_id**, login (uniq, e-posta ya da kullanıcı adı), password_hash, name, role (`OWNER`), must_change_password, is_active, last_login_at | Admin tarafından oluşturulur. Kayıt ekranı yok. |
| `customers` | id, name, email (uniq), phone (uniq), password_hash, email_verified_at, phone_verified_at, kvkk_consent_at, marketing_consent, deleted_at | Müşteriler kendi hesabını açar. |
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
| `businesses` | id, **slug (uniq)**, name, description, phone, address_line, province_id, district_id, **location (PostGIS geography Point)**, logo_key, cover_key, status (`DRAFT`/`ACTIVE`/`SUSPENDED`), is_published, published_at, is_featured, featured_rank, **photo_count (CHECK 0..30)**, rating_avg, rating_count, min_price_kurus (önbellek), created_at, updated_at |
| `business_settings` | business_id (pk), slot_interval_min (vars. 15), min_lead_min (vars. 60), max_advance_days (vars. 30), buffer_min (vars. 0), cancel_cutoff_min (vars. 120), auto_confirm (bool), temp_closed_until (timestamptz, geçici kapanış), temp_closed_note |
| `business_hours` | id, business_id, weekday, start_time, end_time — **Bir gün için birden çok satır = birden çok aralık.** O gün için satır yoksa = kapalı. CHECK(start<end) + aynı gün aralıklar çakışamaz (exclusion). |
| `business_exceptions` | id, business_id, date, kind (`CLOSED`/`CUSTOM_HOURS`), reason (`HOLIDAY`/`SPECIAL`/`VACATION`/`OTHER`), note — uniq(business_id, date) |
| `business_exception_ranges` | id, exception_id, start_time, end_time — Özel gün saatleri. |

### 3.4 Çalışan

| Tablo | Alanlar / Kısıtlar |
|---|---|
| `staff` | id, business_id, name, title, photo_key, bio, is_active, sort_order, deleted_at — uniq(business_id, id) bileşik FK hedefi |
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
- `customer_id` NULL olan kayıtlar, işletmenin panelden manuel girdiği telefon veya kapıdan gelen müşterilerdir *(onay bekliyor — bkz. Soru 6)*.

### 3.7 Randevu

| Tablo | Alanlar / Kısıtlar |
|---|---|
| `appointments` | id, business_id, staff_id, business_customer_id, customer_id (online randevularda dolu), **starts_at, ends_at, blocked_until** (= ends_at + buffer), status (`PENDING`/`CONFIRMED`/`COMPLETED`/`CANCELLED`/`NO_SHOW`), source (`ONLINE`/`PANEL`), subtotal_kurus, points_discount_kurus, total_kurus, points_redeemed, customer_note, internal_note, cancelled_at, cancelled_by_realm, cancel_reason, idempotency_key (uniq), created_at, updated_at |
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
| `reviews` | id, business_id, **appointment_id (uniq)**, customer_id, staff_id, rating (1–5), comment, business_reply, replied_at, status (`VISIBLE`/`HIDDEN`), created_at — **Yalnızca `COMPLETED` randevu için** ve randevu başına tek yorum. |
| `favorites` | customer_id, business_id — PK(customer_id, business_id) |

### 3.10 Sadakat Puanı (işletme bazlı)

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
| `audit_logs` | id, actor_realm, actor_id, business_id, action, entity, entity_id, meta (jsonb), ip, created_at — Admin işlemleri, giriş denemeleri, müşteri verisine erişim. |

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

**İşletme paneli menüsü:** Genel Bakış · Takvim · Randevular · Çalışanlar · Hizmetler · Paketler · Çalışma Saatleri · Portfolyo (18/30) · Müşteriler · Sadakat · Yorumlar · İşletme Profili · Ayarlar

**Admin menüsü:** Gösterge Paneli · İşletmeler (oluştur / düzenle / yayınla / askıya al / giriş bilgisi tanımla / şifre sıfırla) · Raporlar · Hizmet Türleri · Resmî Tatiller · Denetim Kayıtları

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
6. Puan kullanıldıysa bakiye atomik olarak düşülür (`REDEEM`). `business_customers` kaydı upsert edilir, `appointment_events` yazılır → `COMMIT`.
7. Durum: işletmenin `auto_confirm` ayarına göre `CONFIRMED` ya da `PENDING` olur *(bkz. Soru 3)*.

### 5.7 Durum makinesi

```
PENDING  → CONFIRMED | CANCELLED
CONFIRMED→ COMPLETED | CANCELLED | NO_SHOW
COMPLETED, CANCELLED, NO_SHOW → (son durum)
```

- Müşteri, `cancel_cutoff_min` süresi dolmadan kendi randevusunu iptal edebilir ya da değiştirebilir. Değiştirme = aynı transaction'da yeni slotu doğrula + güncelle; exclusion constraint burada da korur.
- İptalde harcanan puan iade edilir (`REFUND`), slot otomatik olarak serbest kalır.
- `COMPLETED` geçişinde puan kazanılır (`EARN`, tekil). `NO_SHOW` ve `CANCELLED` durumlarında puan kazanılmaz.

### 5.8 "Gerçek zamanlı" görünüm

- Slotlar her seçim değişikliğinde sunucudan taze çekilir (önbelleksiz ya da ≤30 sn önbellekli). Kesin kontrol her zaman 5.6'daki transaction'dır.
- Pazaryerinde "Bugün müsait" ve "en yakın boş saat" bilgisi, listelenen sayfadaki işletmeler (sayfa başına ~20) için hesaplanır ve Redis'te 60 sn tutulur. Randevu oluştuğunda ya da iptal edildiğinde ilgili işletmenin önbelleği temizlenir.
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
| Rate limiting (Redis) | Giriş: IP ve hesap başına (örn. 5 deneme / 15 dk, kademeli bekleme). Kayıt, şifre sıfırlama, randevu oluşturma, yükleme ve arama için ayrı limitler. |
| Dosya yükleme | Yalnızca JPEG/PNG/WebP/HEIC kabul edilir. Gerçek tip uzantıdan değil, magic byte'tan anlaşılır. En fazla ~8 MB. sharp ile yeniden kodlanır (WebP, EXIF/GPS temizlenir) ve boyutlandırılır. Rastgele anahtar kullanılır. 30 limiti atomik sayaçla uygulanır. |
| KVKK | Açık rıza ve aydınlatma metni onayı, veri minimizasyonu. İşletme yalnızca kendi müşterisini görür. Müşteri verisine erişim loglanır. Hesap silme ve anonimleştirme sunulur. |
| Hata yönetimi | `AppError(code, httpStatus, kullanıcıMesajı)` → merkezi handler Türkçe mesaj döner, iç detay ve stack trace sızdırılmaz. Loglar pino ile tutulur, PII maskelenir. |
| HTTP başlıkları | CSP, HSTS, X-Frame-Options/frame-ancestors, Referrer-Policy |

---

## 7. Geliştirme Aşamaları

Her aşamanın sonunda: yapılanlar, eksikler ve test sonuçları raporlanır, onay alınmadan sonraki aşamaya geçilmez.

| Aşama | Teslimatlar | Testler |
|---|---|---|
| **1 — Analiz & Mimari** | Bu doküman, açık soruların yanıtlanması | — |
| **2 — Temel altyapı** | Next.js + TS + Tailwind iskeleti, Docker Compose, Drizzle şeması + migration (exclusion constraint dahil), seed (il/ilçe, hizmet türleri, ilk admin), oturum/realm sistemi, guard'lar, rate limit, AppError, audit log. **Admin paneli:** giriş, işletme oluşturma/düzenleme/yayınlama/askıya alma, işletme kullanıcısı tanımlama, temel istatistikler | Realm izolasyonu, şifre hash, rate limit |
| **3 — İşletme paneli** | Giriş (+özel bağlantı, ilk şifre değişimi), işletme profili, çalışma saatleri (çoklu aralık, istisna, tatil, geçici kapanış), otomatik açık/kapalı, çalışanlar (vardiya, mola, izin, yetkinlik), hizmetler, paketler, portfolyo (S3, 30 limiti, kategori, çalışan bağı) | İşletmeler arası izolasyon, foto limiti eşzamanlılık testi |
| **4 — Randevu sistemi** | Müsaitlik motoru, randevu oluşturma/düzenleme/iptal, durum makinesi, panel takvimi (gün/hafta/ay, çalışan bazlı), panelden randevu ekleme, müşteri CRM kaydı, genel bakış metrikleri | **Eşzamanlı çakışma testi** (N paralel istek → tam 1 başarı), algoritma birim testleri (mola, izin, paket, buffer, sınırlar) |
| **5 — Müşteri pazaryeri** | Ana sayfa, arama + filtreler (il/ilçe, fiyat, puan, hizmet türü, bugün müsait, konuma yakınlık), öne çıkan/popüler, berber profili, galeri, harita, randevu sihirbazı (giriş sonrası seçim koruma), müşteri hesabı (randevularım, geçmiş, favoriler, ayarlar), yorumlar | E2E randevu akışı, misafir → giriş → seçim korunması, 401 testi |
| **6 — Sadakat** | Puan ayarları, kazanma (COMPLETED), harcama (randevuda indirim), iade, geçmiş, müşteri "Puanlarım", panelde müşteri bakiyesi | Çift kazanım engeli, bakiye yarışı, iptal iadesi, ledger tutarlılığı |
| **7 — Test & güvenlik** | Yetki matrisi testleri, IDOR taraması, mobil/tablet görünüm testleri (Playwright cihaz profilleri), form/API doğrulama testleri, güvenlik başlıkları, performans kontrolü, PWA hazırlığı (manifest, ikon, offline sayfası) | Tam test raporu |

---

## 8. Açık Sorular

Yanıtlanana kadar kritik karar alınmayacak. Her sorunun yanında önerilen varsayılan belirtilmiştir.

1. **Barındırma ve KVKK:** Yönetilen bulut (Vercel + Neon Postgres + Cloudflare R2 + Upstash Redis: hızlı kurulum, yurt dışı) mı, Türkiye'de bir VPS / yerli bulut (Docker ile: veri yurt içinde) mi? *Öneri: Kod iki seçenekte de çalışacak şekilde taşınabilir yazılır. Kişisel veri yurt dışına aktarımı KVKK yükümlülüğü doğurduğu için canlı ortamda Türkiye lokasyonu önerilir.*
2. **Müşteri kaydı ve girişi:** E-posta + şifre mi, telefon + SMS doğrulama kodu (OTP) mu? SMS için Netgsm / İleti Merkezi gibi bir sağlayıcı ve ücret gerekir. *Öneri: v1'de e-posta + şifre ile giriş, telefon numarası zorunlu alan. SMS doğrulama sağlayıcı netleşince eklenir.*
3. **Randevu ilk durumu:** Müşteri randevu alınca doğrudan "Onaylandı" mı olsun, yoksa işletme onayına kadar "Bekliyor" mu? *Öneri: İşletme başına ayar, varsayılan otomatik onay.*
4. **Ödeme:** v1'de online ödeme yok, ödeme işletmede yapılır. Doğru mu? *Öneri: Evet.* (Puan indirimi randevu tutarından düşülür, kalan tutar işletmede ödenir.)
5. **Admin "gelir takibi":** Platformun işletmelerden aldığı abonelik ücretleri mi (iş modeli nedir?), yoksa işletmelerin tamamlanan randevu cirosunun toplamı mı? *Öneri: v1'de randevu cirosu raporu. Abonelik/faturalandırma modeli sonraya bırakılır.*
6. **Panelden randevu:** İşletme, telefonla arayan ya da kapıdan gelen ve **hesabı olmayan** müşteriye panelden randevu girebilsin mi? (Bu, müşterinin kendi başına misafir randevu alması değildir. Online kanal yine yalnızca üyelere açık kalır.) *Öneri: Evet. Aksi halde takvim gerçeği yansıtmaz ve çakışma kontrolü eksik kalır.*
7. **İşletme kullanıcıları:** v1'de işletme başına yalnızca sahip hesabı mı, yoksa çalışanların kendi takvimini gördüğü ayrı girişler de mi? *Öneri: v1'de yalnızca sahip. Tablo yapısı çoklu kullanıcıya hazır.*
8. **İptal politikası:** Müşteri randevudan kaç saat öncesine kadar iptal ya da değişiklik yapabilir? *Öneri: İşletme ayarı, varsayılan 2 saat.*
9. **Bildirimler:** v1'de onay ve hatırlatma e-postası ya da SMS gönderilsin mi, yoksa yalnızca ekranda onay mı gösterilsin? *Öneri: v1'de ekranda onay + e-posta onayı (ucuz). SMS ve push bildirimi PWA aşamasında eklenir.*
10. **Harita sağlayıcı:** OpenStreetMap/Leaflet (ücretsiz) mi, Google Maps (ücretli, Türkiye adres verisi daha iyi) mi? *Öneri: OpenStreetMap ile başlanır, işletme konumu admin ya da işletme tarafından haritada pin ile seçilir.*
11. **Çoklu hizmet:** Müşteri paket dışında birden fazla hizmeti (örn. saç + sakal) tek randevuda, aynı çalışandan arka arkaya seçebilsin mi? *Öneri: Evet. Süreler toplanır, tek çalışan yapar.*
12. **Paket uygulaması:** Paketin tamamını tek çalışan yapar varsayımı doğru mu? *Öneri: Evet. Hizmetlerin farklı çalışanlara bölünmesi v1 kapsamı dışında.*
13. **Yorumlar:** Yalnızca tamamlanmış randevusu olan müşteri yorum yapabilsin. İşletme yanıt verebilsin, admin gizleyebilsin. Uygun mu? *Öneri: Evet.*
14. **Sadakat puanı kullanımı:** Puan, randevu alırken indirim olarak mı seçilsin (iptalde iade edilir), yoksa işletmede ödeme sırasında işletme tarafından mı düşülsün? *Öneri: Randevu alırken müşteri seçer. İşletme panelden manuel düzeltme de yapabilir.*
