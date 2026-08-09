-- Brand Centre Tab 1-3 tables and Offering extensions

CREATE TYPE "PerformanceColor" AS ENUM ('GREEN', 'YELLOW', 'RED');
CREATE TYPE "LeakBucket" AS ENUM ('PDP', 'PAID', 'ROSTER', 'CREATIVE_HOOK');
CREATE TYPE "PriorityRank" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NEGLIGIBLE');
CREATE TYPE "LeakPlannerStatus" AS ENUM ('PENDING_USER_REVIEW', 'PUSHED_TO_PLANNER', 'DISCARDED', 'EXECUTED');
CREATE TYPE "PlannerCardType" AS ENUM ('NEW_CAMPAIGN', 'SUGGESTED_UPDATE', 'AUTO_PAUSE_LOG');
CREATE TYPE "CampaignObjective" AS ENUM ('PULSE', 'PROOF', 'PUSH', 'PRODUCTION');
CREATE TYPE "CreatorTier" AS ENUM ('NANO', 'MICRO', 'MID_TIER', 'MEGA', 'CELEBRITY');
CREATE TYPE "PlannerWorkflowStatus" AS ENUM ('PENDING_USER_REVIEW', 'PROCEEDED_TO_PIPELINE', 'DISCARDED', 'AUTO_EXECUTED_BYPASS');

ALTER TYPE "OfferingType" ADD VALUE IF NOT EXISTS 'MODULE';
ALTER TYPE "OfferingType" ADD VALUE IF NOT EXISTS 'EXPERIENCE';

ALTER TABLE "offerings"
  ADD COLUMN IF NOT EXISTS "selling_points" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "do_not_say" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "brand_audience_personas" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "persona_name" TEXT NOT NULL,
  "demographics_json" JSONB NOT NULL,
  "psychographics_text" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_user_edited" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_audience_personas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_offers" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "offer_name" TEXT NOT NULL,
  "promo_code" TEXT NOT NULL,
  "applicability_scope" TEXT NOT NULL,
  "validity_start" TIMESTAMP(3) NOT NULL,
  "validity_end" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "entity_link" TEXT,
  "terms_text" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_offers_brand_profile_id_promo_code_key"
  ON "brand_offers"("brand_profile_id", "promo_code");

CREATE TABLE "brand_budget_modification_logs" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "old_budget" DECIMAL(14,2) NOT NULL,
  "new_budget" DECIMAL(14,2) NOT NULL,
  "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_budget_modification_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brand_budget_modification_logs_brand_profile_id_modified_at_idx"
  ON "brand_budget_modification_logs"("brand_profile_id", "modified_at");

CREATE TABLE "brand_intelligence_baselines" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "growth_impact_matrix" JSONB NOT NULL,
  "baseline_health" JSONB NOT NULL,
  "share_of_voice" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ai_inferred',
  "refreshed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_intelligence_baselines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_intelligence_baselines_brand_profile_id_key"
  ON "brand_intelligence_baselines"("brand_profile_id");

CREATE TABLE "brand_planner_cards" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "card_type" "PlannerCardType" NOT NULL,
  "aggregation_key" JSONB NOT NULL,
  "existing_target_campaign_id" TEXT,
  "campaign_metadata" JSONB NOT NULL,
  "assets_and_briefs_matrix" JSONB NOT NULL,
  "workflow_status" "PlannerWorkflowStatus" NOT NULL DEFAULT 'PENDING_USER_REVIEW',
  "source_leak_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_planner_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brand_planner_cards_brand_profile_id_workflow_status_idx"
  ON "brand_planner_cards"("brand_profile_id", "workflow_status");

CREATE TABLE "brand_performance_leaks" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "insight_title" TEXT NOT NULL,
  "short_description" TEXT NOT NULL,
  "priority_rank" "PriorityRank" NOT NULL,
  "leak_bucket" "LeakBucket" NOT NULL,
  "performance_status" "PerformanceColor" NOT NULL,
  "projected_lift_percentage" DECIMAL(6,2) NOT NULL,
  "drawer_deep_dive" JSONB NOT NULL,
  "planner_status" "LeakPlannerStatus" NOT NULL DEFAULT 'PENDING_USER_REVIEW',
  "planner_card_id" TEXT,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "archived_at" TIMESTAMP(3),
  "moved_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_performance_leaks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brand_performance_leaks_brand_profile_id_is_archived_priority_rank_idx"
  ON "brand_performance_leaks"("brand_profile_id", "is_archived", "priority_rank");

ALTER TABLE "brand_audience_personas"
  ADD CONSTRAINT "brand_audience_personas_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_offers"
  ADD CONSTRAINT "brand_offers_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_budget_modification_logs"
  ADD CONSTRAINT "brand_budget_modification_logs_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_intelligence_baselines"
  ADD CONSTRAINT "brand_intelligence_baselines_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_planner_cards"
  ADD CONSTRAINT "brand_planner_cards_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_performance_leaks"
  ADD CONSTRAINT "brand_performance_leaks_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_performance_leaks"
  ADD CONSTRAINT "brand_performance_leaks_planner_card_id_fkey"
  FOREIGN KEY ("planner_card_id") REFERENCES "brand_planner_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
