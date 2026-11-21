ALTER TABLE "banners" ADD COLUMN "placement" text DEFAULT 'HERO' NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "province_id" smallint;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "click_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_placement_ck" CHECK ("banners"."placement" IN ('HERO', 'LISTING'));