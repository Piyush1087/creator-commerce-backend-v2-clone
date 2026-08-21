-- CreateEnum
CREATE TYPE "BrandPreviewRuntimeState" AS ENUM ('ANALYSIS_ACTIVE', 'PREVIEW_READY', 'PREVIEW_FAILED_RECOVERABLE', 'PREVIEW_NOT_READY');

-- CreateEnum
CREATE TYPE "BrandPreviewCompleteness" AS ENUM ('NORMAL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "BrandPreviewPhase" AS ENUM ('UNDERSTANDING_BRAND', 'LEARNING_AUDIENCE', 'FINDING_CREATOR_OPPORTUNITIES', 'PREPARING_PREVIEW');

-- CreateTable
CREATE TABLE "brand_preview_runs" (
    "brand_preview_run_id" UUID NOT NULL,
    "discovery_lead_id" UUID NOT NULL,
    "brand_profile_id" UUID,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "state" "BrandPreviewRuntimeState" NOT NULL DEFAULT 'ANALYSIS_ACTIVE',
    "phase" "BrandPreviewPhase",
    "completeness" "BrandPreviewCompleteness",
    "evidence_snapshot" JSONB,
    "preview_output_snapshot" JSONB,
    "processor_metadata" JSONB,
    "retry_allowed" BOOLEAN NOT NULL DEFAULT false,
    "error_code" VARCHAR(100),
    "enrichment_attempted" BOOLEAN NOT NULL DEFAULT false,
    "lease_token" VARCHAR(64),
    "lease_expires_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_preview_runs_pkey" PRIMARY KEY ("brand_preview_run_id")
);

CREATE UNIQUE INDEX "brand_preview_runs_discovery_lead_id_key" ON "brand_preview_runs"("discovery_lead_id");
CREATE INDEX "brand_preview_runs_state_lease_expires_at_idx" ON "brand_preview_runs"("state", "lease_expires_at");
CREATE INDEX "brand_preview_runs_brand_profile_id_idx" ON "brand_preview_runs"("brand_profile_id");

ALTER TABLE "brand_preview_runs" ADD CONSTRAINT "brand_preview_runs_discovery_lead_id_fkey" FOREIGN KEY ("discovery_lead_id") REFERENCES "discovery_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_preview_runs" ADD CONSTRAINT "brand_preview_runs_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("brand_profile_id") ON DELETE SET NULL ON UPDATE CASCADE;
