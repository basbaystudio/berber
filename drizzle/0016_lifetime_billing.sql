ALTER TABLE "business_applications" DROP CONSTRAINT "business_applications_cycle_ck";--> statement-breakpoint
ALTER TABLE "business_subscriptions" DROP CONSTRAINT "business_subscriptions_cycle_ck";--> statement-breakpoint
ALTER TABLE "subscription_payments" DROP CONSTRAINT "subscription_payments_months_ck";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP CONSTRAINT "subscription_plans_price_ck";--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD COLUMN "lifetime_fee_kurus" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "lifetime_price_kurus" integer;--> statement-breakpoint
ALTER TABLE "business_applications" ADD CONSTRAINT "business_applications_cycle_ck" CHECK ("business_applications"."billing_cycle" IN ('MONTHLY', 'YEARLY', 'LIFETIME'));--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_cycle_ck" CHECK ("business_subscriptions"."billing_cycle" IN ('MONTHLY', 'YEARLY', 'LIFETIME') AND ("business_subscriptions"."billing_cycle" <> 'YEARLY' OR "business_subscriptions"."yearly_fee_kurus" IS NOT NULL) AND ("business_subscriptions"."billing_cycle" <> 'LIFETIME' OR "business_subscriptions"."lifetime_fee_kurus" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_months_ck" CHECK ("subscription_payments"."months" BETWEEN 0 AND 36);--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_price_ck" CHECK ("subscription_plans"."monthly_price_kurus" >= 0 AND ("subscription_plans"."yearly_price_kurus" IS NULL OR "subscription_plans"."yearly_price_kurus" >= 0) AND ("subscription_plans"."lifetime_price_kurus" IS NULL OR "subscription_plans"."lifetime_price_kurus" >= 0));--> statement-breakpoint
UPDATE "subscription_plans" SET "lifetime_price_kurus" = 1499900 WHERE "code" = 'standart' AND "lifetime_price_kurus" IS NULL;--> statement-breakpoint
UPDATE "business_subscriptions" s SET "lifetime_fee_kurus" = p."lifetime_price_kurus" FROM "subscription_plans" p WHERE s."plan_id" = p."id" AND s."lifetime_fee_kurus" IS NULL;
