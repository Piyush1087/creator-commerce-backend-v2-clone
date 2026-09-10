-- C-04 M1 onto freeze: Brand Collaboration Phase 1–4.7 already created these
-- types/tables. Original CREATE statements remain in git at
-- ec395bf5760b295dddd9c3f7e9c2f05485b6b743. This overlay is idempotent so the
-- freeze DB can apply C-04 without recreating existing enums.

DO $$ BEGIN CREATE TYPE "CollaborationLifecycle" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'TERMINATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationStage" AS ENUM ('NEGOTIATION', 'SECUREMENT', 'FULFILLMENT', 'PRODUCTION', 'PUBLISHING_SETTLEMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationStageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationActorClass" AS ENUM ('BRAND', 'CREATOR', 'SYSTEM', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationNegotiationState" AS ENUM ('NOT_REQUIRED', 'AWAITING_CREATOR_PROPOSAL', 'AWAITING_BRAND_DECISION', 'AWAITING_CREATOR_DECISION', 'LOCKED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationPaymentRail" AS ENUM ('PLATFORM_ESCROW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationSecurementState" AS ENUM ('NOT_REQUIRED', 'AWAITING_ESCROW_FUNDING', 'PROCESSING_FUNDING', 'AWAITING_PAYOUT_DETAILS', 'COMPLETED', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationFulfillmentState" AS ENUM ('NOT_STARTED', 'AWAITING_BRAND_FULFILLMENT', 'AWAITING_CREATOR_CONFIRMATION', 'REMEDIATION_REQUIRED', 'COMPLETED', 'SKIPPED', 'HARD_STOP', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationDeliverableState" AS ENUM ('AWAITING_SUBMISSION', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'AUTO_APPROVED', 'HARD_STOP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationSubmissionReviewState" AS ENUM ('UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'AUTO_APPROVED', 'FINAL_REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationPublishingState" AS ENUM ('PUBLISHING_NOT_REQUIRED', 'AWAITING_PUBLISHING', 'EVIDENCE_SUBMITTED', 'CORRECTION_REQUIRED', 'COMPLIANCE_VERIFIED', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationPublicationAuthorizationState" AS ENUM ('NOT_REQUIRED', 'NOT_AUTHORIZED', 'AUTHORIZED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationEventKind" AS ENUM ('DOMAIN', 'AUDIT', 'INTEGRATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationResolutionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'RESOLVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationFinancialOutcome" AS ENUM ('NORMAL_SUCCESS', 'NEGOTIATION_EXIT', 'PRE_SECUREMENT_EXIT', 'BRAND_PROTECTED_POST_SECUREMENT_EXIT', 'FULFILLMENT_HARD_STOP', 'PRODUCTION_HARD_STOP', 'CREATOR_NON_PERFORMANCE', 'CREATOR_PUBLISHING_NON_PERFORMANCE', 'ADMIN_RESOLUTION', 'OTHER_POLICY_RESOLUTION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationSettlementState" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'PROCESSING', 'SETTLED', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationSettlementLegState" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'CONFIRMED', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationFeedbackAuthorRole" AS ENUM ('BRAND', 'CREATOR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CollaborationFeedbackVisibility" AS ENUM ('HIDDEN', 'REVEALED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "CollaborationNegotiationState" ADD VALUE IF NOT EXISTS 'AWAITING_CREATOR_PROPOSAL';

ALTER TABLE "collaborations"
  ADD COLUMN IF NOT EXISTS "campaign_asset_id" TEXT,
  ADD COLUMN IF NOT EXISTS "lifecycle" "CollaborationLifecycle" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "canonical_stage" "CollaborationStage" NOT NULL DEFAULT 'NEGOTIATION',
  ADD COLUMN IF NOT EXISTS "current_stage_status" "CollaborationStageStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN IF NOT EXISTS "aggregate_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "ended_from_stage" "CollaborationStage",
  ADD COLUMN IF NOT EXISTS "ended_reason_code" TEXT,
  ADD COLUMN IF NOT EXISTS "ended_reason_text" TEXT,
  ADD COLUMN IF NOT EXISTS "ended_by_actor_class" "CollaborationActorClass",
  ADD COLUMN IF NOT EXISTS "ended_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "collaboration_execution_snapshots" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "campaign_context" JSONB NOT NULL,
  "campaign_asset_context" JSONB NOT NULL,
  "brief_context" JSONB NOT NULL,
  "application_context" JSONB,
  "creator_context" JSONB,
  "brand_context" JSONB,
  "usage_rights" JSONB,
  "creator_requirements" TEXT,
  "receives_brand_support" BOOLEAN NOT NULL DEFAULT false,
  "physical_delivery_required" BOOLEAN NOT NULL DEFAULT false,
  "brand_support_type" "UceBrandSupportType",
  "brand_support_estimated_value" DECIMAL(12,2),
  "campaign_commercial_context" JSONB,
  "advance_percentage_snapshot" INTEGER NOT NULL,
  "commercial_currency" VARCHAR(3) NOT NULL,
  "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaboration_execution_snapshots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "collaboration_execution_snapshots"
  ADD COLUMN IF NOT EXISTS "physical_delivery_required" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "collaboration_commercial_agreements" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "negotiation_state" "CollaborationNegotiationState" NOT NULL,
  "application_proposed_fee" DECIMAL(14,2),
  "brand_counter_fee" DECIMAL(14,2),
  "agreed_creator_fee" DECIMAL(14,2),
  "currency" VARCHAR(3) NOT NULL,
  "advance_percentage_snapshot" INTEGER NOT NULL,
  "advance_amount" DECIMAL(14,2),
  "balance_amount" DECIMAL(14,2),
  "pricing_tier_snapshot" VARCHAR(80),
  "business_country_code_snapshot" VARCHAR(2),
  "financial_policy_version_snapshot" VARCHAR(80),
  "platform_commission_rate_snapshot" DECIMAL(7,4),
  "platform_commission_amount" DECIMAL(14,2),
  "platform_commission_gst_rate_snapshot" DECIMAL(7,4),
  "platform_commission_gst_amount" DECIMAL(14,2),
  "non_cash_consideration" JSONB,
  "payment_rail" "CollaborationPaymentRail" NOT NULL DEFAULT 'PLATFORM_ESCROW',
  "securement_state" "CollaborationSecurementState",
  "required_secured_amount" DECIMAL(14,2),
  "confirmed_secured_amount" DECIMAL(14,2),
  "funding_instruction_ref" TEXT,
  "funding_confirmation_ref" TEXT,
  "escrow_lock_ref" TEXT,
  "terms_locked_at" TIMESTAMP(3),
  "securement_completed_at" TIMESTAMP(3),
  CONSTRAINT "collaboration_commercial_agreements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_fulfillments" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "state" "CollaborationFulfillmentState" NOT NULL DEFAULT 'NOT_STARTED',
  "issue_count" INTEGER NOT NULL DEFAULT 0,
  "shipment_tracking_ref" TEXT,
  "courier_name" TEXT,
  "access_evidence_ref" TEXT,
  "redemption_code" TEXT,
  "service_evidence_ref" TEXT,
  "generic_fulfillment_evidence" JSONB,
  "brand_fulfilled_at" TIMESTAMP(3),
  "creator_confirmed_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "hard_stopped_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_fulfillments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_fulfillment_issues" (
  "id" TEXT NOT NULL,
  "fulfillment_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "issue_code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "evidence_ref" TEXT,
  "reported_by_user_id" TEXT,
  "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remediation_evidence_ref" TEXT,
  "remediation_at" TIMESTAMP(3),
  CONSTRAINT "collaboration_fulfillment_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_deliverable_executions" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "source_brief_deliverable_id" TEXT NOT NULL,
  "display_order" INTEGER NOT NULL,
  "definition_snapshot" JSONB NOT NULL,
  "state" "CollaborationDeliverableState" NOT NULL DEFAULT 'AWAITING_SUBMISSION',
  "revision_request_count" INTEGER NOT NULL DEFAULT 0,
  "publishing_required" BOOLEAN NOT NULL,
  "approved_at" TIMESTAMP(3),
  "auto_approved_at" TIMESTAMP(3),
  "hard_stopped_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_deliverable_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_submission_versions" (
  "id" TEXT NOT NULL,
  "deliverable_execution_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "asset_ref" TEXT NOT NULL,
  "creator_note" TEXT,
  "submission_metadata" JSONB,
  "submitted_by_user_id" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "review_deadline_at" TIMESTAMP(3) NOT NULL,
  "review_state" "CollaborationSubmissionReviewState" NOT NULL DEFAULT 'UNDER_REVIEW',
  "brand_feedback" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "auto_approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_submission_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_publishing_executions" (
  "id" TEXT NOT NULL,
  "deliverable_execution_id" TEXT NOT NULL,
  "state" "CollaborationPublishingState" NOT NULL,
  "authorization_state" "CollaborationPublicationAuthorizationState" NOT NULL,
  "authorized_at" TIMESTAMP(3),
  "authorized_by_user_id" TEXT,
  "compliance_verified_at" TIMESTAMP(3),
  "blocked_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_publishing_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_publishing_evidence" (
  "id" TEXT NOT NULL,
  "publishing_execution_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "evidence_ref" TEXT NOT NULL,
  "platform" VARCHAR(100),
  "creator_note" TEXT,
  "evidence_metadata" JSONB,
  "submitted_by_user_id" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correction_reason" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "verification_evidence_ref" TEXT,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_publishing_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_events" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "kind" "CollaborationEventKind" NOT NULL,
  "event_type" TEXT NOT NULL,
  "actor_class" "CollaborationActorClass" NOT NULL,
  "actor_user_id" TEXT,
  "command_id" TEXT,
  "correlation_id" TEXT,
  "aggregate_version" INTEGER NOT NULL,
  "payload" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaboration_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_financial_resolutions" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "status" "CollaborationResolutionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "outcome" "CollaborationFinancialOutcome",
  "creator_entitlement_amount" DECIMAL(14,2),
  "brand_refund_entitlement_amount" DECIMAL(14,2),
  "creator_gross_entitlement_amount" DECIMAL(14,2),
  "creator_commercial_refund_amount" DECIMAL(14,2),
  "platform_commission_retained_amount" DECIMAL(14,2),
  "platform_commission_refund_amount" DECIMAL(14,2),
  "platform_commission_gst_retained_amount" DECIMAL(14,2),
  "platform_commission_gst_refund_amount" DECIMAL(14,2),
  "brand_commercial_refund_entitlement_amount" DECIMAL(14,2),
  "currency" VARCHAR(3),
  "reason_code" TEXT,
  "reason_text" TEXT,
  "resolution_evidence" JSONB,
  "residual_obligations" JSONB,
  "decided_by_actor_class" "CollaborationActorClass",
  "decided_by_user_id" TEXT,
  "decided_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "collaboration_financial_resolutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_settlements" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "state" "CollaborationSettlementState" NOT NULL DEFAULT 'NOT_ELIGIBLE',
  "creator_payout_state" "CollaborationSettlementLegState" NOT NULL DEFAULT 'NOT_REQUIRED',
  "brand_refund_state" "CollaborationSettlementLegState" NOT NULL DEFAULT 'NOT_REQUIRED',
  "creator_settlement_amount" DECIMAL(14,2),
  "brand_refund_amount" DECIMAL(14,2),
  "currency" VARCHAR(3),
  "payout_instruction_ref" TEXT,
  "refund_instruction_ref" TEXT,
  "payout_execution_ref" TEXT,
  "refund_execution_ref" TEXT,
  "payout_confirmation_ref" TEXT,
  "refund_confirmation_ref" TEXT,
  "authoritative_confirmation_ref" TEXT,
  "eligible_at" TIMESTAMP(3),
  "processing_at" TIMESTAMP(3),
  "settled_at" TIMESTAMP(3),
  "blocked_at" TIMESTAMP(3),
  "blocked_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_feedback_windows" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL,
  "closes_at" TIMESTAMP(3) NOT NULL,
  "visibility" "CollaborationFeedbackVisibility" NOT NULL DEFAULT 'HIDDEN',
  "revealed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_feedback_windows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collaboration_feedback" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "author_role" "CollaborationFeedbackAuthorRole" NOT NULL,
  "author_user_id" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "review_text" TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_feedback_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "collaboration_feedback" ADD CONSTRAINT "collaboration_feedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_execution_snapshots_collaboration_id_key" ON "collaboration_execution_snapshots"("collaboration_id");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_commercial_agreements_collaboration_id_key" ON "collaboration_commercial_agreements"("collaboration_id");
CREATE INDEX IF NOT EXISTS "collaboration_commercial_agreements_negotiation_state_idx" ON "collaboration_commercial_agreements"("negotiation_state");
CREATE INDEX IF NOT EXISTS "collaboration_commercial_agreements_securement_state_idx" ON "collaboration_commercial_agreements"("securement_state");
CREATE INDEX IF NOT EXISTS "collaboration_commercial_agreements_pricing_tier_snapshot_business_country_code_snapshot_idx" ON "collaboration_commercial_agreements"("pricing_tier_snapshot", "business_country_code_snapshot");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_fulfillments_collaboration_id_key" ON "collaboration_fulfillments"("collaboration_id");
CREATE INDEX IF NOT EXISTS "collaboration_fulfillments_state_idx" ON "collaboration_fulfillments"("state");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_fulfillment_issues_fulfillment_id_sequence_key" ON "collaboration_fulfillment_issues"("fulfillment_id", "sequence");
CREATE INDEX IF NOT EXISTS "collaboration_fulfillment_issues_fulfillment_id_reported_at_idx" ON "collaboration_fulfillment_issues"("fulfillment_id", "reported_at");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_deliverable_executions_collaboration_id_source_brief_deliverable_id_key" ON "collaboration_deliverable_executions"("collaboration_id", "source_brief_deliverable_id");
CREATE INDEX IF NOT EXISTS "collaboration_deliverable_executions_collaboration_id_state_idx" ON "collaboration_deliverable_executions"("collaboration_id", "state");
CREATE INDEX IF NOT EXISTS "collaboration_deliverable_executions_source_brief_deliverable_id_idx" ON "collaboration_deliverable_executions"("source_brief_deliverable_id");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_submission_versions_deliverable_execution_id_version_number_key" ON "collaboration_submission_versions"("deliverable_execution_id", "version_number");
CREATE INDEX IF NOT EXISTS "collaboration_submission_versions_review_state_review_deadline_at_idx" ON "collaboration_submission_versions"("review_state", "review_deadline_at");
CREATE INDEX IF NOT EXISTS "collaboration_submission_versions_deliverable_execution_id_submitted_at_idx" ON "collaboration_submission_versions"("deliverable_execution_id", "submitted_at");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_publishing_executions_deliverable_execution_id_key" ON "collaboration_publishing_executions"("deliverable_execution_id");
CREATE INDEX IF NOT EXISTS "collaboration_publishing_executions_state_idx" ON "collaboration_publishing_executions"("state");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_publishing_evidence_publishing_execution_id_sequence_key" ON "collaboration_publishing_evidence"("publishing_execution_id", "sequence");
CREATE INDEX IF NOT EXISTS "collaboration_publishing_evidence_publishing_execution_id_submitted_at_idx" ON "collaboration_publishing_evidence"("publishing_execution_id", "submitted_at");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_events_collaboration_id_command_id_key" ON "collaboration_events"("collaboration_id", "command_id");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_events_collaboration_id_aggregate_version_key" ON "collaboration_events"("collaboration_id", "aggregate_version");
CREATE INDEX IF NOT EXISTS "collaboration_events_collaboration_id_aggregate_version_idx" ON "collaboration_events"("collaboration_id", "aggregate_version");
CREATE INDEX IF NOT EXISTS "collaboration_events_event_type_occurred_at_idx" ON "collaboration_events"("event_type", "occurred_at");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_financial_resolutions_collaboration_id_key" ON "collaboration_financial_resolutions"("collaboration_id");
CREATE INDEX IF NOT EXISTS "collaboration_financial_resolutions_status_idx" ON "collaboration_financial_resolutions"("status");
CREATE INDEX IF NOT EXISTS "collaboration_financial_resolutions_outcome_idx" ON "collaboration_financial_resolutions"("outcome");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_settlements_collaboration_id_key" ON "collaboration_settlements"("collaboration_id");
CREATE INDEX IF NOT EXISTS "collaboration_settlements_state_idx" ON "collaboration_settlements"("state");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_feedback_windows_collaboration_id_key" ON "collaboration_feedback_windows"("collaboration_id");
CREATE INDEX IF NOT EXISTS "collaboration_feedback_windows_visibility_closes_at_idx" ON "collaboration_feedback_windows"("visibility", "closes_at");
CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_feedback_collaboration_id_author_role_key" ON "collaboration_feedback"("collaboration_id", "author_role");
CREATE INDEX IF NOT EXISTS "collaboration_feedback_collaboration_id_submitted_at_idx" ON "collaboration_feedback"("collaboration_id", "submitted_at");

DO $$ BEGIN ALTER TABLE "collaboration_execution_snapshots" ADD CONSTRAINT "collaboration_execution_snapshots_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_commercial_agreements" ADD CONSTRAINT "collaboration_commercial_agreements_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_fulfillments" ADD CONSTRAINT "collaboration_fulfillments_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_fulfillment_issues" ADD CONSTRAINT "collaboration_fulfillment_issues_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "collaboration_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_deliverable_executions" ADD CONSTRAINT "collaboration_deliverable_executions_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_submission_versions" ADD CONSTRAINT "collaboration_submission_versions_deliverable_execution_id_fkey" FOREIGN KEY ("deliverable_execution_id") REFERENCES "collaboration_deliverable_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_publishing_executions" ADD CONSTRAINT "collaboration_publishing_executions_deliverable_execution_id_fkey" FOREIGN KEY ("deliverable_execution_id") REFERENCES "collaboration_deliverable_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_publishing_evidence" ADD CONSTRAINT "collaboration_publishing_evidence_publishing_execution_id_fkey" FOREIGN KEY ("publishing_execution_id") REFERENCES "collaboration_publishing_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_events" ADD CONSTRAINT "collaboration_events_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_financial_resolutions" ADD CONSTRAINT "collaboration_financial_resolutions_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_settlements" ADD CONSTRAINT "collaboration_settlements_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_feedback_windows" ADD CONSTRAINT "collaboration_feedback_windows_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "collaboration_feedback" ADD CONSTRAINT "collaboration_feedback_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- C-04 points executions at campaign_brief_deliverables. Freeze Phase 1 pointed
-- them at uce_brief_deliverables. Retarget only when existing rows already
-- satisfy the C-04 FK (or the table is empty).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "collaboration_deliverable_executions" e
    WHERE NOT EXISTS (
      SELECT 1 FROM "campaign_brief_deliverables" d
      WHERE d."deliverable_id" = e."source_brief_deliverable_id"
    )
  ) THEN
    ALTER TABLE "collaboration_deliverable_executions"
      DROP CONSTRAINT IF EXISTS "collaboration_deliverable_executions_source_brief_delivera_fkey";
    ALTER TABLE "collaboration_deliverable_executions"
      DROP CONSTRAINT IF EXISTS "collaboration_deliverable_executions_source_brief_deliverable_id_fkey";
    ALTER TABLE "collaboration_deliverable_executions"
      ADD CONSTRAINT "collaboration_deliverable_executions_source_brief_deliverable_id_fkey"
      FOREIGN KEY ("source_brief_deliverable_id") REFERENCES "campaign_brief_deliverables"("deliverable_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
