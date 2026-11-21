CREATE TYPE "public"."appointment_source" AS ENUM('ONLINE', 'PANEL');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."auth_token_purpose" AS ENUM('EMAIL_VERIFY', 'PASSWORD_RESET');--> statement-breakpoint
CREATE TYPE "public"."business_status" AS ENUM('DRAFT', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."cancel_reason" AS ENUM('CUSTOMER', 'BUSINESS', 'NOT_CONFIRMED_IN_TIME', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."exception_kind" AS ENUM('CLOSED', 'CUSTOM_HOURS');--> statement-breakpoint
CREATE TYPE "public"."exception_reason" AS ENUM('HOLIDAY', 'SPECIAL', 'VACATION', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('QUEUED', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('BANK_TRANSFER', 'CASH', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."realm" AS ENUM('CUSTOMER', 'BUSINESS', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('SPAM', 'INSULT', 'MISLEADING', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('OPEN', 'REJECTED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('VISIBLE', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."time_off_kind" AS ENUM('LEAVE', 'SICK', 'BLOCK');--> statement-breakpoint
CREATE TABLE "districts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "districts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"province_id" smallint NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "provinces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "public_holidays" (
	"date" date PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_half_day" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "service_types_name_unique" UNIQUE("name"),
	CONSTRAINT "service_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"realm" realm NOT NULL,
	"principal_id" uuid NOT NULL,
	"purpose" "auth_token_purpose" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"login" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"kvkk_consent_at" timestamp with time zone NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"realm" realm NOT NULL,
	"principal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "business_exception_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exception_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "ber_range_ck" CHECK ("business_exception_ranges"."start_time" < "business_exception_ranges"."end_time")
);
--> statement-breakpoint
CREATE TABLE "business_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "exception_kind" NOT NULL,
	"reason" "exception_reason" DEFAULT 'OTHER' NOT NULL,
	"note" text,
	CONSTRAINT "business_exceptions_day_uq" UNIQUE("business_id","date")
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "business_hours_weekday_ck" CHECK ("business_hours"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "business_hours_range_ck" CHECK ("business_hours"."start_time" < "business_hours"."end_time")
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"slot_interval_min" smallint DEFAULT 15 NOT NULL,
	"min_lead_min" integer DEFAULT 60 NOT NULL,
	"max_advance_days" smallint DEFAULT 30 NOT NULL,
	"buffer_min" smallint DEFAULT 0 NOT NULL,
	"temp_closed_until" timestamp with time zone,
	"temp_closed_note" text,
	CONSTRAINT "bs_slot_ck" CHECK ("business_settings"."slot_interval_min" IN (5, 10, 15, 20, 30, 60)),
	CONSTRAINT "bs_lead_ck" CHECK ("business_settings"."min_lead_min" BETWEEN 0 AND 10080),
	CONSTRAINT "bs_adv_ck" CHECK ("business_settings"."max_advance_days" BETWEEN 1 AND 365),
	CONSTRAINT "bs_buffer_ck" CHECK ("business_settings"."buffer_min" BETWEEN 0 AND 120)
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"phone" text NOT NULL,
	"address_line" text NOT NULL,
	"province_id" smallint NOT NULL,
	"district_id" integer NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"logo_key" text,
	"cover_key" text,
	"status" "business_status" DEFAULT 'DRAFT' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_rank" integer,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"min_price_kurus" integer,
	"last_panel_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_photo_count_ck" CHECK ("businesses"."photo_count" BETWEEN 0 AND 30),
	CONSTRAINT "businesses_coords_ck" CHECK (("businesses"."latitude" IS NULL AND "businesses"."longitude" IS NULL) OR ("businesses"."latitude" BETWEEN -90 AND 90 AND "businesses"."longitude" BETWEEN -180 AND 180)),
	CONSTRAINT "businesses_published_active_ck" CHECK (NOT "businesses"."is_published" OR "businesses"."status" = 'ACTIVE')
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"photo_key" text,
	"bio" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "staff_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "staff_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "staff_breaks_weekday_ck" CHECK ("staff_breaks"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "staff_breaks_range_ck" CHECK ("staff_breaks"."start_time" < "staff_breaks"."end_time")
);
--> statement-breakpoint
CREATE TABLE "staff_services" (
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "staff_services_staff_id_service_id_pk" PRIMARY KEY("staff_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "staff_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "staff_shifts_weekday_ck" CHECK ("staff_shifts"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "staff_shifts_range_ck" CHECK ("staff_shifts"."start_time" < "staff_shifts"."end_time")
);
--> statement-breakpoint
CREATE TABLE "staff_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"kind" time_off_kind DEFAULT 'LEAVE' NOT NULL,
	"note" text,
	CONSTRAINT "staff_time_off_range_ck" CHECK ("staff_time_off"."starts_at" < "staff_time_off"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "package_items" (
	"business_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "package_items_package_id_service_id_pk" PRIMARY KEY("package_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "package_staff" (
	"business_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	CONSTRAINT "package_staff_package_id_staff_id_pk" PRIMARY KEY("package_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_kurus" integer NOT NULL,
	"duration_min" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "packages_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "packages_price_ck" CHECK ("packages"."price_kurus" >= 0),
	CONSTRAINT "packages_duration_ck" CHECK ("packages"."duration_min" BETWEEN 5 AND 600 AND "packages"."duration_min" % 5 = 0)
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"service_type_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"price_kurus" integer NOT NULL,
	"duration_min" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "services_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "services_price_ck" CHECK ("services"."price_kurus" >= 0),
	CONSTRAINT "services_duration_ck" CHECK ("services"."duration_min" BETWEEN 5 AND 600 AND "services"."duration_min" % 5 = 0)
);
--> statement-breakpoint
CREATE TABLE "appointment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"from_status" "appointment_status",
	"to_status" "appointment_status" NOT NULL,
	"actor_realm" realm,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"service_id" uuid,
	"package_id" uuid,
	"name_snapshot" text NOT NULL,
	"price_snapshot_kurus" integer NOT NULL,
	"duration_snapshot_min" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"business_customer_id" uuid NOT NULL,
	"customer_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'PENDING' NOT NULL,
	"source" "appointment_source" NOT NULL,
	"confirm_deadline" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"total_kurus" integer NOT NULL,
	"customer_note" text,
	"internal_note" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" "cancel_reason",
	"cancel_note" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "appointments_range_ck" CHECK ("appointments"."starts_at" < "appointments"."ends_at" AND "appointments"."ends_at" <= "appointments"."blocked_until"),
	CONSTRAINT "appointments_total_ck" CHECK ("appointments"."total_kurus" >= 0),
	CONSTRAINT "appointments_online_customer_ck" CHECK ("appointments"."source" <> 'ONLINE' OR "appointments"."customer_id" IS NOT NULL),
	CONSTRAINT "appointments_cancel_ck" CHECK (("appointments"."status" = 'CANCELLED') = ("appointments"."cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "business_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid,
	"display_name" text NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"first_visit_at" timestamp with time zone,
	"last_visit_at" timestamp with time zone,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_customers_business_id_uq" UNIQUE("business_id","id")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"customer_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_customer_id_business_id_pk" PRIMARY KEY("customer_id","business_id")
);
--> statement-breakpoint
CREATE TABLE "portfolio_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "portfolio_categories_business_id_uq" UNIQUE("business_id","id"),
	CONSTRAINT "portfolio_categories_name_uq" UNIQUE("business_id","name")
);
--> statement-breakpoint
CREATE TABLE "portfolio_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid,
	"category_id" uuid,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'OPEN' NOT NULL,
	"resolved_by_admin_id" uuid,
	"resolved_at" timestamp with time zone,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"customer_id" uuid,
	"staff_id" uuid,
	"rating" smallint NOT NULL,
	"comment" text,
	"business_reply" text,
	"replied_at" timestamp with time zone,
	"status" "review_status" DEFAULT 'VISIBLE' NOT NULL,
	"removed_by_admin_id" uuid,
	"removed_at" timestamp with time zone,
	"removal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_ck" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_realm" realm,
	"actor_id" uuid,
	"business_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"meta" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"plan_name" text NOT NULL,
	"monthly_fee_kurus" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_trust_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"components" jsonb NOT NULL,
	"computed_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_trust_scores" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"sample_size" integer NOT NULL,
	"components" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text DEFAULT 'EMAIL' NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"appointment_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_admin_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"subscription_id" uuid,
	"amount_kurus" integer NOT NULL,
	"paid_on" date NOT NULL,
	"method" "payment_method" NOT NULL,
	"period_label" text,
	"note" text,
	"recorded_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_users" ADD CONSTRAINT "business_users_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_exception_ranges" ADD CONSTRAINT "business_exception_ranges_exception_id_business_exceptions_id_fk" FOREIGN KEY ("exception_id") REFERENCES "public"."business_exceptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_exceptions" ADD CONSTRAINT "business_exceptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_breaks" ADD CONSTRAINT "staff_breaks_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_fk" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_package_fk" FOREIGN KEY ("business_id","package_id") REFERENCES "public"."packages"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_service_fk" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_staff" ADD CONSTRAINT "package_staff_package_fk" FOREIGN KEY ("business_id","package_id") REFERENCES "public"."packages"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_staff" ADD CONSTRAINT "package_staff_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_bcustomer_fk" FOREIGN KEY ("business_id","business_customer_id") REFERENCES "public"."business_customers"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_customers" ADD CONSTRAINT "business_customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_customers" ADD CONSTRAINT "business_customers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_categories" ADD CONSTRAINT "portfolio_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_staff_fk" FOREIGN KEY ("business_id","staff_id") REFERENCES "public"."staff"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_category_fk" FOREIGN KEY ("business_id","category_id") REFERENCES "public"."portfolio_categories"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_resolved_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_removed_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("removed_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appointment_fk" FOREIGN KEY ("business_id","appointment_id") REFERENCES "public"."appointments"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_trust_history" ADD CONSTRAINT "business_trust_history_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_trust_scores" ADD CONSTRAINT "business_trust_scores_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_business_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."business_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recorded_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "districts_province_slug_uq" ON "districts" USING btree ("province_id","slug");--> statement-breakpoint
CREATE INDEX "districts_province_idx" ON "districts" USING btree ("province_id");--> statement-breakpoint
CREATE INDEX "auth_tokens_principal_idx" ON "auth_tokens" USING btree ("realm","principal_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "business_users_login_uq" ON "business_users" USING btree (lower("login"));--> statement-breakpoint
CREATE INDEX "business_users_business_idx" ON "business_users" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_uq" ON "customers" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_email_uq" ON "platform_admins" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_ends_at");--> statement-breakpoint
CREATE INDEX "sessions_principal_idx" ON "sessions" USING btree ("realm","principal_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "business_hours_business_idx" ON "business_hours" USING btree ("business_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_uq" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "businesses_location_idx" ON "businesses" USING btree ("province_id","district_id");--> statement-breakpoint
CREATE INDEX "staff_business_idx" ON "staff" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_breaks_staff_idx" ON "staff_breaks" USING btree ("staff_id","weekday");--> statement-breakpoint
CREATE INDEX "staff_services_service_idx" ON "staff_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "staff_shifts_staff_idx" ON "staff_shifts" USING btree ("staff_id","weekday");--> statement-breakpoint
CREATE INDEX "staff_time_off_staff_idx" ON "staff_time_off" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "services_business_idx" ON "services" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "appointment_events_appt_idx" ON "appointment_events" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_events_business_idx" ON "appointment_events" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "appointment_items_appt_idx" ON "appointment_items" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_idempotency_uq" ON "appointments" USING btree ("idempotency_key") WHERE "appointments"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "appointments_business_start_idx" ON "appointments" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_staff_start_idx" ON "appointments" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_pending_deadline_idx" ON "appointments" USING btree ("confirm_deadline") WHERE "appointments"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "business_customers_account_uq" ON "business_customers" USING btree ("business_id","customer_id") WHERE "business_customers"."customer_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "business_customers_phone_idx" ON "business_customers" USING btree ("business_id","phone");--> statement-breakpoint
CREATE INDEX "portfolio_photos_business_idx" ON "portfolio_photos" USING btree ("business_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "review_reports_open_uq" ON "review_reports" USING btree ("review_id") WHERE "review_reports"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "review_reports_status_idx" ON "review_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_appointment_uq" ON "reviews" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "reviews_business_idx" ON "reviews" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_business_idx" ON "audit_logs" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "business_subscriptions_business_idx" ON "business_subscriptions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_trust_history_idx" ON "business_trust_history" USING btree ("business_id","computed_on");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "subscription_payments_business_idx" ON "subscription_payments" USING btree ("business_id","paid_on");