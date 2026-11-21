# Berber Pazaryeri ve Randevu Platformu

Müşteri pazaryeri, berber işletme paneli ve platform yönetim paneli. Mimari ve kararlar: [`docs/MIMARI.md`](docs/MIMARI.md).

**Teknoloji:** Next.js 16 (App Router) · TypeScript · PostgreSQL + Drizzle ORM · Tailwind CSS 4 · Vitest · Playwright

## Kurulum (yerel)

```bash
npm install
cp .env.example .env
docker compose up -d          # PostgreSQL (ya da kendi Postgres'iniz)
npm run db:migrate            # tabloları ve çakışma kısıtlarını kurar
npm run db:seed               # 81 il, 973 ilçe, hizmet türleri, platform ayarları
ADMIN_EMAIL=siz@ornek.com ADMIN_NAME="Ad Soyad" ADMIN_PASSWORD='en-az-12-karakter1' npm run admin:create
npm run dev
```

Örnek verilerle denemek için (yalnızca yerel/önizleme veritabanında):

```bash
npm run db:seed-demo          # 6 örnek berber, müşteriler, yorumlar, randevular
```

Demo girişleri: yönetici `demo-admin@ornek.local` / `DemoAdmin2026!` · işletme `demo-isletme` / `DemoIsletme2026` · müşteri `demo-musteri@ornek.local` / `DemoMusteri2026`

- Platform yönetimi: http://localhost:3000/admin
- İşletme girişi: http://localhost:3000/isletme (bilgileri admin verir; işletmeye özel: /isletme/<isletme-adi>)

## Testler

```bash
npm test                      # birim + entegrasyon (TEST_DATABASE_URL'deki veritabanını SIFIRLAR)
npm run build && npm run e2e  # tarayıcı testleri (masaüstü, tablet, mobil): akışlar, güvenlik, erişilebilirlik, PWA; berber_e2e veritabanını sıfırlar
```

## Canlı ortam (Vercel + Neon)

Adım adım kontrol listesi: [`docs/CANLIYA-CIKIS.md`](docs/CANLIYA-CIKIS.md).

1. Neon'da (Frankfurt) veritabanı oluşturun, `DATABASE_URL` olarak *pooled* bağlantı adresini Vercel'e ekleyin.
2. Yerelden `DATABASE_URL=... npm run db:migrate && npm run db:seed` ve `npm run admin:create` çalıştırın.
3. Vercel'de fonksiyon bölgesi `vercel.json` ile `fra1` olarak ayarlıdır.
4. Ortam değişkenleri: `CRON_SECRET` (günlük görev için zorunlu), `RESEND_API_KEY` + `EMAIL_FROM` (e-posta), `BLOB_READ_WRITE_TOKEN` (görseller). Ayrıntılar `.env.example` dosyasında.
5. Günlük bakım görevi (`/api/cron/daily`, her gün 09:00 TR): abonelik gecikme kontrolü, e-postalar, otomatik askıya alma, eski oturum temizliği.

## Klasör yapısı

- `src/app` — sayfalar (pazaryeri, `/isletme`, `/admin`) ve server action'lar (ince katman)
- `src/server/modules` — iş kuralları (yalnızca sunucu)
- `src/server/auth` — oturum, şifre, realm guard'ları, rate limit
- `src/server/db/schema` — veritabanı şeması · `drizzle/` — migration'lar
- `tests/` — birim, entegrasyon, e2e
