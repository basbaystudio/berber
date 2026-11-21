ALTER TABLE "subscription_payments" ADD COLUMN "invoice_key" text;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "invoice_url" text;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "invoice_file_name" text;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "invoice_uploaded_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "subscription_payments_invoice_pending_idx" ON "subscription_payments" USING btree ("paid_at") WHERE "subscription_payments"."invoice_key" IS NULL;