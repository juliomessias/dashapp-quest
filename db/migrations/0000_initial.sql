CREATE TYPE "public"."account_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'analyst', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "ad_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meta_account_id" varchar(80) NOT NULL,
	"name" varchar(220) NOT NULL,
	"brand_id" uuid NOT NULL,
	"market" varchar(100) NOT NULL,
	"analyst_id" uuid,
	"facebook_page_id" varchar(100),
	"instagram_profile_id" varchar(100),
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"timezone" varchar(80) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"last_successful_sync_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "analysts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity" varchar(120) NOT NULL,
	"before_values" jsonb,
	"after_values" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(40) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_monthly_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"account_id" uuid,
	"brand_id" uuid,
	"month" integer NOT NULL,
	"weight" numeric(8, 6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_daily_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_date" date NOT NULL,
	"account_id" uuid NOT NULL,
	"campaign_id" varchar(100) DEFAULT '' NOT NULL,
	"adset_id" varchar(100) DEFAULT '' NOT NULL,
	"ad_id" varchar(100) DEFAULT '' NOT NULL,
	"spend" numeric(18, 2) DEFAULT '0' NOT NULL,
	"impressions" numeric(20, 0) DEFAULT '0' NOT NULL,
	"daily_reach" numeric(20, 0) DEFAULT '0' NOT NULL,
	"engagements" numeric(20, 0) DEFAULT '0' NOT NULL,
	"video_views" numeric(20, 0) DEFAULT '0' NOT NULL,
	"clicks" numeric(20, 0) DEFAULT '0' NOT NULL,
	"results" numeric(20, 2) DEFAULT '0' NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(80) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"meta_field" varchar(160) NOT NULL,
	"unit" varchar(40) NOT NULL,
	"aggregation_rule" varchar(80) NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer,
	"account_id" uuid,
	"brand_id" uuid,
	"metric_key" varchar(80) NOT NULL,
	"value" numeric(20, 2) NOT NULL,
	"source" varchar(80) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"budget" numeric(18, 2) NOT NULL,
	"prepaid_balance" numeric(18, 2),
	"source" varchar(80) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reach_period_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"level" varchar(30) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reach" numeric(20, 0) NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_daily_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_date" date NOT NULL,
	"account_id" uuid NOT NULL,
	"profile_id" varchar(100) NOT NULL,
	"followers_total" integer NOT NULL,
	"likes_total" integer NOT NULL,
	"followers_delta" integer DEFAULT 0 NOT NULL,
	"likes_delta" integer DEFAULT 0 NOT NULL,
	"source" varchar(80) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"account_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "user_account_access" (
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	CONSTRAINT "user_account_access_user_id_account_id_pk" PRIMARY KEY("user_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_analyst_id_analysts_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."analysts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_monthly_weights" ADD CONSTRAINT "goal_monthly_weights_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_monthly_weights" ADD CONSTRAINT "goal_monthly_weights_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_daily_insights" ADD CONSTRAINT "meta_daily_insights_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_goals" ADD CONSTRAINT "metric_goals_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_goals" ADD CONSTRAINT "metric_goals_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reach_period_cache" ADD CONSTRAINT "reach_period_cache_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_daily_insights" ADD CONSTRAINT "social_daily_insights_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_access" ADD CONSTRAINT "user_account_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_access" ADD CONSTRAINT "user_account_access_account_id_ad_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_accounts_meta_id_uidx" ON "ad_accounts" USING btree ("meta_account_id");--> statement-breakpoint
CREATE INDEX "ad_accounts_brand_idx" ON "ad_accounts" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "ad_accounts_analyst_idx" ON "ad_accounts" USING btree ("analyst_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analysts_email_uidx" ON "analysts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_code_uidx" ON "brands" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_weights_scope_uidx" ON "goal_monthly_weights" USING btree ("year","account_id","brand_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_insights_identity_uidx" ON "meta_daily_insights" USING btree ("insight_date","account_id","campaign_id","adset_id","ad_id");--> statement-breakpoint
CREATE INDEX "meta_insights_range_idx" ON "meta_daily_insights" USING btree ("account_id","insight_date");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_definitions_key_uidx" ON "metric_definitions" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_goals_scope_uidx" ON "metric_goals" USING btree ("year","month","account_id","brand_id","metric_key");--> statement-breakpoint
CREATE INDEX "metric_goals_year_idx" ON "metric_goals" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_budgets_scope_uidx" ON "monthly_budgets" USING btree ("year","month","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reach_cache_scope_uidx" ON "reach_period_cache" USING btree ("account_id","level","start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "social_insights_identity_uidx" ON "social_daily_insights" USING btree ("insight_date","profile_id");--> statement-breakpoint
CREATE INDEX "social_insights_range_idx" ON "social_daily_insights" USING btree ("account_id","insight_date");--> statement-breakpoint
CREATE INDEX "sync_runs_account_started_idx" ON "sync_runs" USING btree ("account_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");