ALTER TABLE "business_subscriptions" ADD COLUMN "payment_provider" text;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD COLUMN "provider_customer_ref" text;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD COLUMN "provider_subscription_ref" text;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD COLUMN "card_brand" text;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD COLUMN "card_last4" text;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD COLUMN "auto_renew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "business_subscriptions_provider_sub_uq" ON "business_subscriptions" USING btree ("payment_provider","provider_subscription_ref") WHERE "business_subscriptions"."provider_subscription_ref" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_last4_ck" CHECK ("business_subscriptions"."card_last4" IS NULL OR "business_subscriptions"."card_last4" ~ '^[0-9]{4}$');