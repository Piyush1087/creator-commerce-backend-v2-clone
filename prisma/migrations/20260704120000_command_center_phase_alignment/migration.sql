-- Command center workspace phase alignment (creator campaigns)

CREATE TYPE "UceProductionPhase" AS ENUM (
  'INBOUND_INVITE',
  'APPLICATION_REVIEW',
  'SHORTLISTED',
  'LOGISTICS_TRANSIT',
  'CONTENT_DRAFTING',
  'SAFETY_REVIEW',
  'LIVE_SCRAPING',
  'ARCHIVED_COMPLETED',
  'ARCHIVED_CLOSED'
);

CREATE TYPE "UceWorkflowActionRole" AS ENUM ('CREATOR', 'BRAND', 'NONE');

CREATE TYPE "UceDraftReviewStatus" AS ENUM (
  'AWAITING_REVIEW',
  'APPROVED',
  'REVISION_REQUESTED'
);

ALTER TABLE "uce_campaign_collaborations"
  ADD COLUMN "creator_profile_id" TEXT,
  ADD COLUMN "content_format_type" VARCHAR(50),
  ADD COLUMN "current_phase" "UceProductionPhase" NOT NULL DEFAULT 'APPLICATION_REVIEW',
  ADD COLUMN "action_required_by_role" "UceWorkflowActionRole" NOT NULL DEFAULT 'BRAND',
  ADD COLUMN "production_deadline_at" TIMESTAMP(3);

ALTER TABLE "uce_campaign_collaborations"
  ADD CONSTRAINT "uce_campaign_collaborations_creator_profile_id_fkey"
  FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "uce_collaboration_logistics" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "carrier_name" VARCHAR(100) NOT NULL,
  "tracking_id" VARCHAR(100) NOT NULL,
  "estimated_delivery_at" TIMESTAMP(3),
  "actual_delivered_at" TIMESTAMP(3),
  "is_received_by_creator" BOOLEAN NOT NULL DEFAULT false,
  "is_package_damaged" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "uce_collaboration_logistics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uce_collaboration_content_drafts" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "draft_url" TEXT NOT NULL,
  "submission_version" INTEGER NOT NULL DEFAULT 1,
  "review_state" "UceDraftReviewStatus" NOT NULL DEFAULT 'AWAITING_REVIEW',
  "brand_safety_feedback" TEXT,
  "submission_notes" TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  CONSTRAINT "uce_collaboration_content_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uce_collaboration_live_telemetry" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "content_live_url" TEXT NOT NULL,
  "total_views" INTEGER NOT NULL DEFAULT 0,
  "total_reach" INTEGER NOT NULL DEFAULT 0,
  "engagement_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "days_public_count" INTEGER NOT NULL DEFAULT 0,
  "last_scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "uce_collaboration_live_telemetry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uce_collaboration_logistics_collaboration_id_key"
  ON "uce_collaboration_logistics"("collaboration_id");

CREATE UNIQUE INDEX "uce_collaboration_live_telemetry_collaboration_id_key"
  ON "uce_collaboration_live_telemetry"("collaboration_id");

CREATE INDEX "idx_draft_review_lookup"
  ON "uce_collaboration_content_drafts"("collaboration_id", "review_state");

CREATE INDEX "idx_panic_panel_evaluation"
  ON "uce_campaign_collaborations"("creator_profile_id", "action_required_by_role", "production_deadline_at");

CREATE INDEX "idx_workspace_phase_router"
  ON "uce_campaign_collaborations"("creator_profile_id", "current_phase");

ALTER TABLE "uce_collaboration_logistics"
  ADD CONSTRAINT "uce_collaboration_logistics_collaboration_id_fkey"
  FOREIGN KEY ("collaboration_id") REFERENCES "uce_campaign_collaborations"("collaboration_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "uce_collaboration_content_drafts"
  ADD CONSTRAINT "uce_collaboration_content_drafts_collaboration_id_fkey"
  FOREIGN KEY ("collaboration_id") REFERENCES "uce_campaign_collaborations"("collaboration_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "uce_collaboration_live_telemetry"
  ADD CONSTRAINT "uce_collaboration_live_telemetry_collaboration_id_fkey"
  FOREIGN KEY ("collaboration_id") REFERENCES "uce_campaign_collaborations"("collaboration_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill creator profile linkage from normalized Instagram handles
UPDATE "uce_campaign_collaborations" AS c
SET "creator_profile_id" = cp."id"
FROM "creator_profiles" AS cp
WHERE c."creator_profile_id" IS NULL
  AND cp."instagram_handle" IS NOT NULL
  AND LOWER(REGEXP_REPLACE(cp."instagram_handle", '^@', '')) = LOWER(c."instagram_handle");

-- Backfill command-center phase columns from legacy UCE status/milestone fields
UPDATE "uce_campaign_collaborations"
SET
  "current_phase" = CASE
    WHEN "collab_status" IN ('PROSPECT_CURATED', 'PROSPECT_INVITED') THEN 'INBOUND_INVITE'::"UceProductionPhase"
    WHEN "collab_status" = 'APPLICANT_PENDING' THEN 'APPLICATION_REVIEW'::"UceProductionPhase"
    WHEN "collab_status" = 'APPLICANT_SHORTLISTED' THEN 'SHORTLISTED'::"UceProductionPhase"
    WHEN "collab_status" = 'ARCHIVED_COMPLETE' THEN 'ARCHIVED_COMPLETED'::"UceProductionPhase"
    WHEN "collab_status" IN ('APPLICANT_REJECTED', 'TERMINATED_CANCELED') THEN 'ARCHIVED_CLOSED'::"UceProductionPhase"
    WHEN "collab_status" = 'ACTIVE_WORKFLOW' AND "current_milestone" = 'STAGE_5_PUBLISHING' THEN 'LIVE_SCRAPING'::"UceProductionPhase"
    WHEN "collab_status" = 'ACTIVE_WORKFLOW'
      AND "current_milestone" = 'STAGE_4_CONTENT_REVIEW'
      AND "content_draft_url" IS NOT NULL THEN 'SAFETY_REVIEW'::"UceProductionPhase"
    WHEN "collab_status" = 'ACTIVE_WORKFLOW'
      AND "current_milestone" = 'STAGE_3_LOGISTICS'
      AND "logistics_state" = 'IN_TRANSIT' THEN 'LOGISTICS_TRANSIT'::"UceProductionPhase"
    WHEN "collab_status" = 'ACTIVE_WORKFLOW' THEN 'CONTENT_DRAFTING'::"UceProductionPhase"
    ELSE 'APPLICATION_REVIEW'::"UceProductionPhase"
  END,
  "action_required_by_role" = CASE
    WHEN "collab_status" IN ('PROSPECT_CURATED', 'PROSPECT_INVITED') THEN 'CREATOR'::"UceWorkflowActionRole"
    WHEN "collab_status" IN ('APPLICANT_PENDING', 'APPLICANT_SHORTLISTED') THEN 'BRAND'::"UceWorkflowActionRole"
    WHEN "collab_status" = 'ACTIVE_WORKFLOW'
      AND "current_milestone" = 'STAGE_4_CONTENT_REVIEW'
      AND "content_draft_url" IS NOT NULL THEN 'BRAND'::"UceWorkflowActionRole"
    WHEN "collab_status" = 'ACTIVE_WORKFLOW'
      AND "current_milestone" IN ('STAGE_3_LOGISTICS', 'STAGE_4_CONTENT_REVIEW', 'STAGE_5_PUBLISHING')
      THEN 'CREATOR'::"UceWorkflowActionRole"
    ELSE 'NONE'::"UceWorkflowActionRole"
  END,
  "production_deadline_at" = CASE
    WHEN "collab_status" = 'ACTIVE_WORKFLOW'
      AND "current_milestone" IN ('STAGE_3_LOGISTICS', 'STAGE_4_CONTENT_REVIEW', 'STAGE_5_PUBLISHING')
      THEN "current_milestone_deadline"
    ELSE NULL
  END;
