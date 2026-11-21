DROP INDEX "business_trust_history_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "business_trust_history_day_uq" ON "business_trust_history" USING btree ("business_id","computed_on");