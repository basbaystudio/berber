CREATE TYPE "public"."payment_method" AS ENUM('CARD', 'BANK_TRANSFER', 'CASH', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('SUCCEEDED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"image_key" text NOT NULL,
	"image_url" text NOT NULL,
	"image_width" integer NOT NULL,
	"image_height" integer NOT NULL,
	"link_url" text,
	"button_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banners_range_ck" CHECK ("banners"."starts_at" IS NULL OR "banners"."ends_at" IS NULL OR "banners"."starts_at" < "banners"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "business_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"monthly_fee_kurus" integer NOT NULL,
	"trial_months" integer NOT NULL,
	"trial_starts_on" date,
	"trial_ends_on" date,
	"paid_through" date,
	"is_early_adopter" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_subscriptions_fee_ck" CHECK ("business_subscriptions"."monthly_fee_kurus" >= 0),
	CONSTRAINT "business_subscriptions_trial_ck" CHECK ("business_subscriptions"."trial_months" BETWEEN 0 AND 36)
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"plan_id" uuid,
	"amount_kurus" integer NOT NULL,
	"months" integer NOT NULL,
	"covers_from" date NOT NULL,
	"covers_to" date NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'SUCCEEDED' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"recorded_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_amount_ck" CHECK ("subscription_payments"."amount_kurus" >= 0),
	CONSTRAINT "subscription_payments_months_ck" CHECK ("subscription_payments"."months" BETWEEN 1 AND 36),
	CONSTRAINT "subscription_payments_range_ck" CHECK ("subscription_payments"."covers_from" < "subscription_payments"."covers_to")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"monthly_price_kurus" integer NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_price_ck" CHECK ("subscription_plans"."monthly_price_kurus" >= 0)
);
--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_business_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."business_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recorded_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banners_active_idx" ON "banners" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "business_subscriptions_business_uq" ON "business_subscriptions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_business_idx" ON "subscription_payments" USING btree ("business_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payments_provider_ref_uq" ON "subscription_payments" USING btree ("provider","provider_ref") WHERE "subscription_payments"."provider_ref" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_code_uq" ON "subscription_plans" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_default_uq" ON "subscription_plans" USING btree ("is_default") WHERE "subscription_plans"."is_default";