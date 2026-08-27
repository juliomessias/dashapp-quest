DROP INDEX "metric_goals_scope_uidx";--> statement-breakpoint
ALTER TABLE "analysts" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "metric_goals" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "metric_goals" ADD COLUMN "changed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "monthly_budgets" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "monthly_budgets" ADD COLUMN "changed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "metric_goals" ADD CONSTRAINT "metric_goals_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "metric_goals_scope_uidx" ON "metric_goals" USING btree ("year",coalesce("month", 0),coalesce("account_id"::text, "brand_id"::text),"metric_key");--> statement-breakpoint
ALTER TABLE "metric_goals" ADD CONSTRAINT "metric_goals_scope_check" CHECK ((("metric_goals"."account_id" is not null)::int + ("metric_goals"."brand_id" is not null)::int) = 1);--> statement-breakpoint
ALTER TABLE "metric_goals" ADD CONSTRAINT "metric_goals_month_check" CHECK ("metric_goals"."month" is null or "metric_goals"."month" between 1 and 10);--> statement-breakpoint
ALTER TABLE "metric_goals" ADD CONSTRAINT "metric_goals_value_check" CHECK ("metric_goals"."value" >= 0);--> statement-breakpoint
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_month_check" CHECK ("monthly_budgets"."month" between 1 and 12);--> statement-breakpoint
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_value_check" CHECK ("monthly_budgets"."budget" >= 0 and ("monthly_budgets"."prepaid_balance" is null or "monthly_budgets"."prepaid_balance" >= 0));