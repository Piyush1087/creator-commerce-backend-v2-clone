-- Brand Intelligence pipeline (Phases 4-7): Checkpoint 1 -> Stage 1B -> Brand DNA.

CREATE TYPE "BrandIntelligenceStage" AS ENUM (
  'STAGE_1A_COMPLETE',
  'CORE_IDENTITY_APPROVED',
  'STAGE_1B_COMPLETE',
  'STAGE_1B_FAILED',
  'STAGE_2_BRAND_DNA_COMPLETE',
  'STAGE_2_BRAND_DNA_FAILED',
  'STAGE_2_BRAND_DNA_ARCHIVED',
  'STAGE_2_NEEDS_REVIEW'
);

CREATE TABLE "brand_intelligence_scans" (
  "id" TEXT NOT NULL,
  "discovery_lead_id" TEXT NOT NULL,
  "brand_profile_id" TEXT,
  "website_url" TEXT NOT NULL,
  "current_stage" "BrandIntelligenceStage" NOT NULL,
  "stage1a_snapshot" JSONB,
  "authoritative_identity" JSONB,
  "runtime_context" JSONB,
  "brand_dna_raw" JSONB,
  "brand_dna_verified_snapshot" JSONB,
  "error_logs" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "brand_intelligence_scans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_intelligence_scans_discovery_lead_id_key" ON "brand_intelligence_scans"("discovery_lead_id");
CREATE INDEX "brand_intelligence_scans_brand_profile_id_idx" ON "brand_intelligence_scans"("brand_profile_id");
CREATE INDEX "brand_intelligence_scans_current_stage_idx" ON "brand_intelligence_scans"("current_stage");

ALTER TABLE "brand_intelligence_scans" ADD CONSTRAINT "brand_intelligence_scans_discovery_lead_id_fkey" FOREIGN KEY ("discovery_lead_id") REFERENCES "discovery_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_intelligence_scans" ADD CONSTRAINT "brand_intelligence_scans_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
