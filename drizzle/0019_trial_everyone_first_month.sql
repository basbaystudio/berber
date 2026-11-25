-- Kampanya: "ilk 20 işletmeye 3 ay" kaldırıldı; artık herkese ilk ay ücretsiz.
-- Daha önce kampanyadan hak kazanmış işletmelerin süreleri korunur (yalnızca yeni onaylar etkilenir).
INSERT INTO "platform_settings" ("key", "value") VALUES ('billing.earlyAdopter', '{"limit": 0, "trialMonths": 1}'::jsonb)
ON CONFLICT ("key") DO UPDATE SET "value" = '{"limit": 0, "trialMonths": 1}'::jsonb;--> statement-breakpoint
INSERT INTO "platform_settings" ("key", "value") VALUES ('billing.defaultTrialMonths', '1'::jsonb)
ON CONFLICT ("key") DO UPDATE SET "value" = '1'::jsonb;
