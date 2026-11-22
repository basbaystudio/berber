CREATE TABLE "business_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"province_id" smallint NOT NULL,
	"district_id" integer NOT NULL,
	"address_line" text NOT NULL,
	"staff_count" smallint NOT NULL,
	"plan_id" uuid NOT NULL,
	"billing_cycle" text NOT NULL,
	"note" text,
	"kvkk_consent_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"business_id" uuid,
	"reviewed_by_admin_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reject_reason" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_applications_status_ck" CHECK ("business_applications"."status" IN ('NEW', 'APPROVED', 'REJECTED')),
	CONSTRAINT "business_applications_cycle_ck" CHECK ("business_applications"."billing_cycle" IN ('MONTHLY', 'YEARLY')),
	CONSTRAINT "business_applications_staff_ck" CHECK ("business_applications"."staff_count" BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "business_applications" ADD CONSTRAINT "business_applications_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_applications" ADD CONSTRAINT "business_applications_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_applications" ADD CONSTRAINT "business_applications_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_applications" ADD CONSTRAINT "business_applications_reviewed_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_applications_status_idx" ON "business_applications" USING btree ("status","created_at");