ALTER TABLE "subscription_plans" DROP CONSTRAINT "subscription_plans_price_ck";--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD COLUMN "yearly_fee_kurus" integer;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD COLUMN "billing_cycle" text DEFAULT 'MONTHLY' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "yearly_price_kurus" integer;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_cycle_ck" CHECK ("business_subscriptions"."billing_cycle" IN ('MONTHLY', 'YEARLY') AND ("business_subscriptions"."billing_cycle" = 'MONTHLY' OR "business_subscriptions"."yearly_fee_kurus" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_price_ck" CHECK ("subscription_plans"."monthly_price_kurus" >= 0 AND ("subscription_plans"."yearly_price_kurus" IS NULL OR "subscription_plans"."yearly_price_kurus" >= 0));