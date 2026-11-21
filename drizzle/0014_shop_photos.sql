CREATE TABLE "shop_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_photos_kind_ck" CHECK ("shop_photos"."kind" IN ('INTERIOR', 'EXTERIOR')),
	CONSTRAINT "shop_photos_by_ck" CHECK ("shop_photos"."uploaded_by" IN ('ADMIN', 'BUSINESS'))
);
--> statement-breakpoint
ALTER TABLE "shop_photos" ADD CONSTRAINT "shop_photos_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_photos_business_idx" ON "shop_photos" USING btree ("business_id","sort_order");