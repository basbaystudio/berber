CREATE TABLE "business_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"review_note" text,
	"reviewed_by_admin_id" uuid,
	"reviewed_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_documents_type_uq" UNIQUE("business_id","type_id"),
	CONSTRAINT "business_documents_status_ck" CHECK ("business_documents"."status" IN ('PENDING', 'APPROVED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "business_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "contract_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"change_note" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by_admin_id" uuid,
	CONSTRAINT "contract_versions_uq" UNIQUE("contract_id","version")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "business_documents" ADD CONSTRAINT "business_documents_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_documents" ADD CONSTRAINT "business_documents_type_id_document_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_documents" ADD CONSTRAINT "business_documents_reviewed_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_inbox" ADD CONSTRAINT "business_inbox_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_version_id_contract_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_accepted_by_user_id_business_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."business_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_published_by_admin_id_platform_admins_id_fk" FOREIGN KEY ("published_by_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_documents_status_idx" ON "business_documents" USING btree ("status","uploaded_at");--> statement-breakpoint
CREATE INDEX "business_inbox_business_idx" ON "business_inbox" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "business_inbox_unread_idx" ON "business_inbox" USING btree ("business_id") WHERE "business_inbox"."read_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_acceptances_uq" ON "contract_acceptances" USING btree ("version_id","business_id");