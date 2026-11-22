-- Yeni fiyatlar: 349,90 TL/ay, 3.490 TL/yıl (tek seferlik 14.999 TL değişmez).
-- Yalnızca eski varsayılan fiyatta duran paket ve aboneliklere dokunulur; elle özel fiyat verilmişler korunur.
UPDATE "business_subscriptions" s SET "monthly_fee_kurus" = 34990, "yearly_fee_kurus" = 349000
FROM "subscription_plans" p
WHERE s."plan_id" = p."id" AND p."code" = 'standart' AND s."monthly_fee_kurus" = 69990 AND s."yearly_fee_kurus" = 699000;--> statement-breakpoint
UPDATE "subscription_plans" SET "monthly_price_kurus" = 34990, "yearly_price_kurus" = 349000, "updated_at" = now()
WHERE "code" = 'standart' AND "monthly_price_kurus" = 69990 AND "yearly_price_kurus" = 699000;
