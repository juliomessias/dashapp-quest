CREATE TABLE "meta_account_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"available_account_id" uuid NOT NULL,
	"meta_account_id" varchar(80) NOT NULL,
	"account_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"market" varchar(100) NOT NULL,
	"analyst_id" uuid,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"history_start_date" date NOT NULL,
	"access_status" varchar(40) DEFAULT 'not_tested' NOT NULL,
	"last_access_test_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_available_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"meta_account_id" varchar(80) NOT NULL,
	"name" varchar(220) NOT NULL,
	"business_id" varchar(100),
	"business_name" varchar(220),
	"external_status" varchar(40) DEFAULT 'unknown' NOT NULL,
	"currency" varchar(3),
	"timezone" varchar(80),
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"business_id" varchar(100),
	"business_name" varchar(220),
	"encrypted_access_token" text,
	"token_expires_at" timestamp with time zone,
	"granted_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(40) DEFAULT 'awaiting_authorization' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_sync_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"state_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "account_link_id" uuid;--> statement-breakpoint
ALTER TABLE "meta_account_links" ADD CONSTRAINT "meta_account_links_connection_id_meta_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."meta_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_account_links" ADD CONSTRAINT "meta_account_links_available_account_id_meta_available_accounts_id_fk" FOREIGN KEY ("available_account_id") REFERENCES "public"."meta_available_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_account_links" ADD CONSTRAINT "meta_account_links_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_account_links" ADD CONSTRAINT "meta_account_links_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_account_links" ADD CONSTRAINT "meta_account_links_analyst_id_analysts_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."analysts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_available_accounts" ADD CONSTRAINT "meta_available_accounts_connection_id_meta_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."meta_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_oauth_states" ADD CONSTRAINT "meta_oauth_states_connection_id_meta_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."meta_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meta_account_links_meta_uidx" ON "meta_account_links" USING btree ("meta_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_account_links_internal_uidx" ON "meta_account_links" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_account_links_available_uidx" ON "meta_account_links" USING btree ("available_account_id");--> statement-breakpoint
CREATE INDEX "meta_account_links_connection_idx" ON "meta_account_links" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_available_accounts_scope_uidx" ON "meta_available_accounts" USING btree ("connection_id","meta_account_id");--> statement-breakpoint
CREATE INDEX "meta_available_accounts_meta_idx" ON "meta_available_accounts" USING btree ("meta_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_connections_user_uidx" ON "meta_connections" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "meta_connections_status_idx" ON "meta_connections" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_oauth_states_hash_uidx" ON "meta_oauth_states" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "meta_oauth_states_connection_idx" ON "meta_oauth_states" USING btree ("connection_id");--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_connection_id_meta_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."meta_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_account_link_id_meta_account_links_id_fk" FOREIGN KEY ("account_link_id") REFERENCES "public"."meta_account_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_runs_connection_started_idx" ON "sync_runs" USING btree ("connection_id","started_at");