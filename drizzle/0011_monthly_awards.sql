CREATE TABLE "monthly_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"business_id" uuid NOT NULL,
	"rating_avg" text NOT NULL,
	"review_count" integer NOT NULL,
	"awarded_by_admin_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monthly_awards" ADD CONSTRAINT "monthly_awards_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_awards" ADD CONSTRAINT "monthly_awards_awarded_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("awarded_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_awards_month_uq" ON "monthly_awards" USING btree ("month");--> statement-breakpoint
CREATE INDEX "monthly_awards_business_idx" ON "monthly_awards" USING btree ("business_id");