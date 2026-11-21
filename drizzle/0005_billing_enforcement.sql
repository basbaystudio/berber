ALTER TABLE "businesses" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "republish_on_reactivate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "business_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_uq" ON "notifications" USING btree ("dedupe_key");