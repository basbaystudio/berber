-- Randevu çakışma koruması: aynı çalışana, aktif (Bekliyor/Onaylandı) durumdaki randevular
-- için [starts_at, blocked_until) aralıkları örtüşemez. Uygulama katmanından bağımsız, veritabanı garantisidir.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    tstzrange("starts_at", "blocked_until", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));
--> statement-breakpoint
-- Aynı gün için işletme çalışma aralıkları birbiriyle örtüşemez
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_no_overlap"
  EXCLUDE USING gist (
    "business_id" WITH =,
    "weekday" WITH =,
    tsrange('2000-01-01'::date + "start_time", '2000-01-01'::date + "end_time", '[)') WITH &&
  );
--> statement-breakpoint
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    "weekday" WITH =,
    tsrange('2000-01-01'::date + "start_time", '2000-01-01'::date + "end_time", '[)') WITH &&
  );
