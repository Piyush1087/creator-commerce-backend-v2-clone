-- Brand Centre foundation: routing, jobs, cold-start budget

CREATE TYPE "BrandRoutingType" AS ENUM (
  'D2C_SKINCARE',
  'SAAS_PRODUCT',
  'HEALTHCARE_TREATMENT',
  'OFFLINE_EXPERIENCE'
);

CREATE TYPE "BudgetAllocationPhase" AS ENUM (
  'PHASE_1_COLD_START',
  'PHASE_2_SELF_HEALING'
);

CREATE TYPE "BrandCentreJobType" AS ENUM (
  'DEEP_SCAN',
  'INTELLIGENCE_REFRESH',
  'PLANNER_AGGREGATE'
);

CREATE TYPE "BrandCentreJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED'
);

ALTER TABLE "brand_profiles"
  ADD COLUMN "brand_routing_type" "BrandRoutingType" NOT NULL DEFAULT 'D2C_SKINCARE',
  ADD COLUMN "lifecycle_stage" TEXT NOT NULL DEFAULT 'GROWTH_STAGE',
  ADD COLUMN "strategic_dna" JSONB,
  ADD COLUMN "ig_handle" TEXT,
  ADD COLUMN "yt_handle" TEXT,
  ADD COLUMN "tiktok_handle" TEXT,
  ADD COLUMN "deep_scan_completed_at" TIMESTAMP(3);

CREATE TABLE "brand_centre_jobs" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "type" "BrandCentreJobType" NOT NULL,
  "status" "BrandCentreJobStatus" NOT NULL DEFAULT 'QUEUED',
  "payload" JSONB,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "brand_centre_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_budget_configurations" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "master_monthly_budget" DECIMAL(14,2) NOT NULL,
  "allocation_phase" "BudgetAllocationPhase" NOT NULL DEFAULT 'PHASE_1_COLD_START',
  "asset_mix" JSONB NOT NULL,
  "tier_mix" JSONB NOT NULL,
  "objective_mix" JSONB NOT NULL,
  "utilized_booked" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "utilized_spent" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "ai_explanation_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_budget_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_budget_configurations_brand_profile_id_key"
  ON "brand_budget_configurations"("brand_profile_id");

CREATE INDEX "brand_centre_jobs_brand_profile_id_type_status_idx"
  ON "brand_centre_jobs"("brand_profile_id", "type", "status");

ALTER TABLE "brand_centre_jobs"
  ADD CONSTRAINT "brand_centre_jobs_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_budget_configurations"
  ADD CONSTRAINT "brand_budget_configurations_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
