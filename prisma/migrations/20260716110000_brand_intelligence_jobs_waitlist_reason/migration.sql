-- Extend BrandIntelligenceStage
DO $$ BEGIN
  ALTER TYPE "BrandIntelligenceStage" ADD VALUE 'CHECKPOINT_2_CONFIRMED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum WaitlistReason
DO $$ BEGIN
  CREATE TYPE "WaitlistReason" AS ENUM (
    'UNSUPPORTED_INDUSTRY',
    'FOREIGN_LANGUAGE',
    'CONTENT_UNREADABLE',
    'PARKED_DOMAIN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum BrandIntelligenceJobType
DO $$ BEGIN
  CREATE TYPE "BrandIntelligenceJobType" AS ENUM ('STAGE_1B_PIPELINE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum BrandIntelligenceJobStatus
DO $$ BEGIN
  CREATE TYPE "BrandIntelligenceJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable brand_intelligence_scans
ALTER TABLE "brand_intelligence_scans"
  ADD COLUMN IF NOT EXISTS "checkpoint2_confirmation" JSONB;

-- AlterTable waitlist_leads
ALTER TABLE "waitlist_leads"
  ADD COLUMN IF NOT EXISTS "domain" VARCHAR(255);

ALTER TABLE "waitlist_leads"
  ADD COLUMN IF NOT EXISTS "reason" "WaitlistReason";

CREATE INDEX IF NOT EXISTS "waitlist_leads_domain_idx" ON "waitlist_leads"("domain");

-- CreateTable brand_intelligence_jobs
CREATE TABLE IF NOT EXISTS "brand_intelligence_jobs" (
  "id" TEXT NOT NULL,
  "discovery_lead_id" TEXT NOT NULL,
  "scan_id" TEXT,
  "type" "BrandIntelligenceJobType" NOT NULL DEFAULT 'STAGE_1B_PIPELINE',
  "status" "BrandIntelligenceJobStatus" NOT NULL DEFAULT 'QUEUED',
  "payload" JSONB,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "error_message" TEXT,
  "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "brand_intelligence_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "brand_intelligence_jobs_status_queued_at_idx"
  ON "brand_intelligence_jobs"("status", "queued_at");

CREATE INDEX IF NOT EXISTS "brand_intelligence_jobs_discovery_lead_id_idx"
  ON "brand_intelligence_jobs"("discovery_lead_id");

DO $$ BEGIN
  ALTER TABLE "brand_intelligence_jobs"
    ADD CONSTRAINT "brand_intelligence_jobs_discovery_lead_id_fkey"
    FOREIGN KEY ("discovery_lead_id") REFERENCES "discovery_leads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "brand_intelligence_jobs"
    ADD CONSTRAINT "brand_intelligence_jobs_scan_id_fkey"
    FOREIGN KEY ("scan_id") REFERENCES "brand_intelligence_scans"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
